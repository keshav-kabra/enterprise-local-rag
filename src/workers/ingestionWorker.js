import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { INGESTION_QUEUE_NAME } from '../config/queue.js';
import { TechnicalTextSplitter } from '../services/textsplitter.js';
import { generateEmbedding } from '../services/embedding.js';
import { pool } from '../config/db.js';

const splitter = new TechnicalTextSplitter({ chunkSize: 250, chunkOverlap: 25 });

/**
 * Optimized worker processor utilizing batch unnesting queries to prevent N+1 overhead
 */
const workerProcessor = async (job) => {
  const { filename, fileContent, mimeType, fileSize } = job.data;
  console.log(`📥 [Worker] Intercepted job: ${filename} (${fileSize} bytes)`);

  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // 1. Insert file tracking records into the metadata table
    const documentQuery = `
      INSERT INTO documents (filename, mime_type, file_size_bytes)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const documentResult = await dbClient.query(documentQuery, [filename, mimeType, fileSize]);
    const documentId = documentResult.rows[0].id; // Extracted row ID correctly

    // 2. Segment text data
    const textChunks = splitter.splitText(fileContent);
    console.log(`✂️ [Worker] Fragmented file into [${textChunks.length}] chunks. Processing embeddings...`);

    // Senior Optimization: Prepare localized memory arrays for batch insertion
    const indices = [];
    const contents = [];
    const embeddings = [];

    // 3. Sequentially resolve multi-dimensional AI matrices from local Ollama hardware
    for (let index = 0; index < textChunks.length; index++) {
      const chunkText = textChunks[index];
      const vectorEmbedding = await generateEmbedding(chunkText);

      indices.push(index);
      contents.push(chunkText);
      // pgvector requires array string notation structures: "[0.1, 0.4, ...]"
      embeddings.push(`[${vectorEmbedding.join(',')}]`);
    }

    // 4. Resolve N+1 issues by running a single bulk query mapping multi-row parameters via UNNEST
    const bulkInsertQuery = `
      INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
      SELECT $1, * FROM UNNEST($2::int[], $3::text[], $4::vector[])
    `;

    console.log(`💾 [Worker] Batch-inserting ${textChunks.length} records into PostgreSQL...`);
    await dbClient.query(bulkInsertQuery, [documentId, indices, contents, embeddings]);

    await dbClient.query('COMMIT');
    console.log(`✅ [Worker] Batch data migration fully complete for: ${filename}`);

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error(`❌ [Worker] Critical pipeline failure on job ${job.id}:`, error.message);
    throw error; 
  } finally {
    dbClient.release();
  }
};

// Start the background processing worker thread listener
export const ingestionWorker = new Worker(INGESTION_QUEUE_NAME, workerProcessor, {
  connection: redisConnection,
  concurrency: 1, 
});

ingestionWorker.on('failed', (job, err) => {
  console.error(`⚠️ Job ${job?.id} permanently stalled out:`, err.message);
});
