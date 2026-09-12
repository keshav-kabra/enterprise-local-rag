import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { INGESTION_QUEUE_NAME } from '../config/queue.js';
import { TechnicalTextSplitter } from '../services/textsplitter.js';
import { generateEmbedding } from '../services/embedding.js';
import { pool } from '../config/db.js';

const splitter = new TechnicalTextSplitter({ chunkSize: 1200, chunkOverlap: 150 });

// 🚀 SENIOR PRACTICE: Set your precise micro-batch step size
const EMBEDDING_BATCH_SIZE = 4; 

const workerProcessor = async (job) => {
  const { filename, fileContent, mimeType, fileSize } = job.data;
  const startTime = Date.now();
  
  console.log(`\n📥 [Worker] Starting ingestion job for: ${filename}`);

  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // 1. Insert Parent Metadata
    const documentQuery = `
      INSERT INTO documents (filename, mime_type, file_size_bytes)
      VALUES ($1, $2, $3) RETURNING id;
    `;
    const documentResult = await dbClient.query(documentQuery, [filename, mimeType, fileSize]);
    const documentId = documentResult.rows[0].id;

    // 🚀 CLEANING PIPELINE: Strip out raw PDF page breaks and header artifacts
    let cleanedContent = fileContent
    // Remove the specific repeated ISO/IEC 27001 header lines
    .replace(/--(?:`|,|-)+.*?ISO\/IEC\s+27001:\d{4}\(E\)/gi, '')
    // Strip standalone page number lines surrounded by spacing
    .replace(/\n\s*\d+\s*\n/g, '\n')
    // Clean up messy artifact trails left behind by the extraction tool
    .replace(/`(?:,|`|-){2,}/g, '');

    // 2. Fragment Text (Now returns an array of structural objects, not strings)
    const structuredChunks = splitter.splitText(cleanedContent);
    console.log(`✂️ [Worker] Fragmented into [${structuredChunks.length}] chunks.`);

    const resolvedVectors = new Array(structuredChunks.length);

    // 🚀 3. MICRO-BATCHING WITH CONTROLLED BACKPRESSURE
    console.log(`🧠 [Worker] Commencing embedding loop with Micro-Batch Size: ${EMBEDDING_BATCH_SIZE}`);
    
    for (let i = 0; i < structuredChunks.length; i += EMBEDDING_BATCH_SIZE) {
      // Slice out the current batch of structural chunk objects
      const batchChunks = structuredChunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchIndices = Array.from({ length: batchChunks.length }, (_, idx) => i + idx);
      
      console.log(`   ⚡ Processing Micro-Batch Chunks [${i} to ${Math.min(i + EMBEDDING_BATCH_SIZE - 1, structuredChunks.length - 1)}]...`);
      
      // Pass only the plain text content string to the embedding generator
      const batchPromises = batchChunks.map(chunk => generateEmbedding(chunk.content));
      const batchVectors = await Promise.all(batchPromises);

      // Assign back to the master array index map
      batchIndices.forEach((globalIdx, localIdx) => {
        resolvedVectors[globalIdx] = batchVectors[localIdx];
      });
    }

    // 4. Map parameters to native array layout structures for bulk insert
    const indices = structuredChunks.map((_, idx) => idx);
    const contents = structuredChunks.map(chunk => chunk.content);
    const headings = structuredChunks.map(chunk => chunk.heading || null);
    const sections = structuredChunks.map(chunk => chunk.section || null);
    const embeddings = resolvedVectors.map(v => `[${v.join(',')}]`);

    // 5. Bulk Database Insertion (Enriched with metadata columns)
    const bulkInsertQuery = `
      INSERT INTO document_chunks (document_id, chunk_index, content, heading, section, embedding)
      SELECT $1, * FROM UNNEST($2::int[], $3::text[], $4::text[], $5::text[], $6::vector[])
    `;

    console.log(`💾 [Worker] Batch-inserting records to PostgreSQL...`);
    await dbClient.query(bulkInsertQuery, [
      documentId, 
      indices, 
      contents, 
      headings, 
      sections, 
      embeddings
    ]);
    
    await dbClient.query('COMMIT');

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [Worker] Ingestion complete in ${durationSec}s for: ${filename}`);

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error(`❌ [Worker] Critical pipeline failure:`, error.message);
    throw error;
  } finally {
    dbClient.release();
  }
};

// 🚀 6. CONCURRENCY BOUNDARY THROTTLING
export const ingestionWorker = new Worker(INGESTION_QUEUE_NAME, workerProcessor, {
  connection: redisConnection,
  concurrency: 1 
});
