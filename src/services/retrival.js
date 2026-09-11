import { generateEmbedding } from './embedding.js';
import { pool } from '../config/db.js';
import { computeLocalCrossEncoderRerank } from './reranker.js'; // Import our new model service

/**
 * Two-Stage Enterprise Retrieval Pipeline (Vector High-Recall + Cross-Encoder High-Precision)
 */
export async function performAdvancedSearchWithRerank(userQuery, candidateRecallLimit = 10) {
  console.log(`🔎 [Stage 1] Broad lookup fetching top ${candidateRecallLimit} candidates via pgvector HNSW map...`);

  try {
    // 1. Generate query vector dimensions
    const queryVector = await generateEmbedding(userQuery);
    const vectorString = `[${queryVector.join(',')}]`;

    // High Recall Phase: Pull 10 rows from PostgreSQL based on fast distance math
    const recallQuery = `
      SELECT c.id, d.filename, c.content, c.chunk_index
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $2;
    `;
    const result = await pool.query(recallQuery, [vectorString, candidateRecallLimit]);
    const databaseCandidates = result.rows;

    if (databaseCandidates.length === 0) return [];

    // 🚀 STAGE 2: Pass the 10 rows into our local neural network classifier
    console.log(`🤖 [Stage 2] Activating Cross-Encoder Model for precision alignment...`);
    const rerankedList = await computeLocalCrossEncoderRerank(userQuery, databaseCandidates);

    // Filter and slice down to the absolute Top 2 best verified segments
    const precisionSelection = rerankedList.slice(0, 2);
    
    console.log(`🎯 [Retrieval Complete] Top cross-encoder alignment score: ${precisionSelection[0]?.rerankScore.toFixed(4)}`);
    return precisionSelection;

  } catch (error) {
    console.error('❌ Advanced two-stage retrieval pipeline failed:', error.message);
    throw error;
  }
}
