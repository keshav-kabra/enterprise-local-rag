import { generateEmbedding } from './embedding.js';
import { pool } from '../config/db.js';

/**
 * Executes a high-performance vector similarity search against PostgreSQL
 * @param {string} userQuery - The raw string question asked by the user
 * @param {number} limit - The maximum number of relevant context chunks to return
 * @returns {Promise<Array<{ content: string, similarity: number }>>}
 */
export async function performSemanticSearch(userQuery, limit = 3) {
  console.log(`🔎 [Retrieval] Computing embedding vector for query: "${userQuery}"`);
  
  try {
    // 1. Convert the user's question into the exact same 768-dimension vector space
    const queryVector = await generateEmbedding(userQuery);
    
    // 2. Format the float array into a pgvector-compliant string format: '[0.1, -0.2, ...]'
    const vectorStringFormat = `[${queryVector.join(',')}]`;

    // 3. Query pgvector using the Cosine Distance operator (<=>)
    // Senior Note: Cosine distance is (1 - Cosine Similarity). 
    // Therefore, smaller distance means higher similarity. We sort ascending (ASC).
    const searchQuery = `
      SELECT 
        content,
        chunk_index,
        1 - (embedding <=> $1::vector) AS similarity_score
      FROM document_chunks
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $2;
    `;

    console.log(`🗄️ [Retrieval] Executing similarity calculation over HNSW index layers...`);
    const result = await pool.query(searchQuery, [vectorStringFormat, limit]);

    console.log(`✅ [Retrieval] Extracted ${result.rowCount} matching context windows from DB.`);
    return result.rows.map(row => ({
      content: row.content,
      chunkIndex: row.chunk_index,
      similarity: parseFloat(row.similarity_score).toFixed(4)
    }));

  } catch (error) {
    console.error('❌ Semantic retrieval pipeline failure:', error.message);
    throw error;
  }
}
