import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { INGESTION_QUEUE_NAME } from '../config/queue.js';
import { TechnicalTextSplitter } from '../services/textsplitter.js';
import { generateEmbedding } from '../services/embedding.js';
import { pool } from '../config/db.js';

const splitter = new TechnicalTextSplitter({ chunkSize: 250, chunkOverlap: 25 });

// 🚀 SENIOR PRACTISE: Set your precise micro-batch step size
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

    // 2. Fragment Text
    const textChunks = splitter.splitText(fileContent);
    console.log(`✂️ [Worker] Fragmented into [${textChunks.length}] chunks.`);

    const resolvedVectors = new Array(textChunks.length);

    // 🚀 3. MICRO-BATCHING WITH CONTROLLED BACKPRESSURE
    console.log(`🧠 [Worker] Commencing embedding loop with Micro-Batch Size: ${EMBEDDING_BATCH_SIZE}`);
    
    for (let i = 0; i < textChunks.length; i += EMBEDDING_BATCH_SIZE) {
      // Slice out the current slice batch of chunks
      const batchChunks = textChunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchIndices = Array.from({ length: batchChunks.length }, (_, idx) => i + idx);
      
      console.log(`   ⚡ Processing Micro-Batch Chunks [${i} to ${Math.min(i + EMBEDDING_BATCH_SIZE - 1, textChunks.length - 1)}]...`);
      
      // Parallel execution restricted ONLY to the small batch size boundaries
      const batchPromises = batchChunks.map(chunk => generateEmbedding(chunk));
      const batchVectors = await Promise.all(batchPromises);

      // Assign back to the complete master array index map
      batchIndices.forEach((globalIdx, localIdx) => {
        resolvedVectors[globalIdx] = batchVectors[localIdx];
      });
    }

    // 4. Map parameters to native array layout structures
    const indices = textChunks.map((_, idx) => idx);
    const embeddings = resolvedVectors.map(v => `[${v.join(',')}]`);

    // 5. Bulk Database Insertion (Single transactional query)
    const bulkInsertQuery = `
      INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
      SELECT $1, * FROM UNNEST($2::int[], $3::text[], $4::vector[])
    `;

    console.log(`💾 [Worker] Batch-inserting records to PostgreSQL...`);
    await dbClient.query(bulkInsertQuery, [documentId, indices, textChunks, embeddings]);
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

// 🚀 6. CONCURRENCY BOUNDARY THROTLLING
export const ingestionWorker = new Worker(INGESTION_QUEUE_NAME, workerProcessor, {
  connection: redisConnection,
  // Concurrency = 1 means BullMQ will wait for the entire current file script processing 
  // to completely finalize before drawing another task from Redis, eliminating multi-file stacking.
  concurrency: 1 
});
