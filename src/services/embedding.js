import { Ollama } from 'ollama';
import dotenv from 'dotenv';

dotenv.config();

// Connect natively to our background Ollama service engine
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

// We explicitly target the fast, enterprise-grade text vector model
const EMBEDDING_MODEL = 'nomic-embed-text';

/**
 * Communicates with local AI hardware layer to compute high-density mathematical matrices
 * @param {string} textChunk - The targeted string segment to embed
 * @returns {Promise<Array<number>>} The resulting 768-dimensional float array
 */
export async function generateEmbedding(textChunk) {
  try {
    const response = await ollama.embeddings({
      model: EMBEDDING_MODEL,
      prompt: textChunk,
    });

    // The vector response array returned by nomic-embed-text has exactly 768 float metrics
    return response.embedding;
  } catch (error) {
    console.error(`❌ Failed to generate vector matrix for chunk via Ollama:`, error.message);
    throw error;
  }
}
