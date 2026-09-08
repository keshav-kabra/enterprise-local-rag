import { Ollama } from 'ollama';
import { performSemanticSearch } from './retrival.js';
import dotenv from 'dotenv';

dotenv.config();

// Connect to your local Ollama background server
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

// We explicitly target the standard local Llama 3.1 8B chat model
const CHAT_MODEL = 'llama3';

/**
 * Executes the complete RAG cycle: Retrieves vectors from PG, structures 
 * a secure system prompt, and pipes token blocks out of Llama 3.
 * 
 * @param {string} userQuestion - The question arriving from our endpoint layer
 * @param {Function} tokenCallback - Fired every single time a new text character token is generated
 */
export async function generateStreamingRAGResponse(userQuestion, tokenCallback) {
  try {
    // 1. RETRIEVAL PHASE: Query pgvector for the top 2 closest context chunks
    const contextMatches = await performSemanticSearch(userQuestion, 2);

    // 2. CONTEXT SYNTHESIS: Flatten the database hits into a single structured string block
    const supportingFactsContext = contextMatches
      .map((match, idx) => `[Database Document Chunk ${idx + 1}]: "${match.content}"`)
      .join('\n\n');

    // 3. PROMPT ENGINEERING GUARDRAILS (The Senior Touch)
    // We lock down the model's instructions so it cannot invent answers.
    const systemPrompt = `
    You are a secure internal enterprise engineering assistant.
    Answer the user's question using ONLY the verified context text blocks provided below.
    
    CRITICAL INSTRUCTIONS:
    - Rely strictly on the explicit facts provided in the context blocks.
    - If the context blocks do not contain enough facts to deduce the answer, reply exactly with: "INSUFFICIENT_INTERNAL_CONTEXT".
    - Do not assume, guess, or reference outside world knowledge.
    - Keep your response professional, precise, and highly concise.

    VERIFIED CONTEXT FROM INTERNAL POSTGRES DATABASE:
    ${supportingFactsContext || "No context blocks were retrieved from the database."}
    `;

    console.log(`🤖 [LLM] Context synthesis complete. Triggering Llama 3 stream connection...`);

    // 4. GENERATION PHASE: Request a streaming chat compilation session from Ollama
    const responseStream = await ollama.chat({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion }
      ],
      stream: true, // Instructs local hardware to stream characters on-the-fly
    });

    // 5. STREAM PIPING: Yield tokens through the loop handler the moment they compile
    for await (const chunk of responseStream) {
      const token = chunk.message.content;
      if (token) {
        tokenCallback(token); // Send text piece straight up to our callback handler
      }
    }

    console.log(`\n✅ [LLM] Real-time text production stream safely closed.`);

  } catch (error) {
    console.error('❌ Critical failure in AI streaming layer:', error.message);
    throw error;
  }
}
