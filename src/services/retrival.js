import { generateEmbedding } from './embedding.js';
import { pool } from '../config/db.js';
import { computeLocalCrossEncoderRerank } from './reranker.js'; 

/**
 * Two-Stage Enterprise Retrieval Pipeline (Vector High-Recall + Cross-Encoder High-Precision)
 * 
 * @param {string} userQuery - The search query string from the user.
 * @param {number} finalPrecisionLimit - The exact number of final top chunks to return (Defaults to 2).
 * @param {number} candidateRecallLimit - How many deep rows to pull from PG vector index for reranking (Defaults to 10).
 */
export async function performSemanticSearch(userQuery, finalPrecisionLimit = 2, candidateRecallLimit = 10) {
  console.log(`🔎 [Stage 1] Broad lookup fetching top ${candidateRecallLimit} candidates via pgvector HNSW map...`);

  try {
    // 1. Generate query vector dimensions
    const queryVector = await generateEmbedding(userQuery);
    const vectorString = `[${queryVector.join(',')}]`;

    // High Recall Phase: Select metadata fields along with the vector match distance
    const recallQuery = `
      SELECT c.id, d.filename, c.content, c.chunk_index, c.heading, c.section
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $2;
    `;
    const result = await pool.query(recallQuery, [vectorString, candidateRecallLimit]);
    const databaseCandidates = result.rows;

    if (databaseCandidates.length === 0) return [];

    // 🚀 STAGE 2: Pass the recall array directly into our local neural network classifier batch pass
    console.log(`🤖 [Stage 2] Activating Cross-Encoder Model for precision alignment...`);
    const rerankedList = await computeLocalCrossEncoderRerank(userQuery, databaseCandidates);

    // 🚀 FIXED: Dynamically slice out exactly what the caller requested instead of a hardcoded 2 rows
    const precisionSelection = rerankedList.slice(0, finalPrecisionLimit);
    
    console.log(`🎯 [Retrieval Complete] Top cross-encoder alignment score: ${precisionSelection[0]?.rerankScore?.toFixed(4) || '0.0000'}`);
    return precisionSelection;

  } catch (error) {
    console.error('❌ Advanced two-stage retrieval pipeline failed:', error.message);
    throw error;
  }
}
