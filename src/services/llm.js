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
    // 🚀 FIXED: Pass 2 as finalPrecisionLimit, and 10 as candidateRecallLimit
    const contextMatches = await performSemanticSearch(userQuestion, 2, 10);

    // 2. CONTEXT SYNTHESIS: Inject structural hierarchy directly into the prompt context layout
    const supportingFactsContext = contextMatches
      .map((match, idx) => {
        const fileTag = `Source File: ${match.filename || 'Unknown'}`;
        const sectionTag = `Section Context: ${match.section || match.heading || 'General Content'}`;
        return `[Reference Asset #${idx + 1}]\n📁 ${fileTag}\n📍 ${sectionTag}\n📝 Content: "${match.content}"`;
      })
      .join('\n\n---\n\n');

    // 3. PROMPT ENGINEERING GUARDRAILS (The Senior Touch)
    const systemPrompt = `
    You are a secure internal enterprise engineering assistant.
    Answer the user's question using ONLY the verified context text blocks provided below.

    CRITICAL INSTRUCTIONS:
    - Present your answer using clean, beautifully formatted Markdown bullet points or numbered lists. Do not jam everything into one paragraph.
    - Weave your source citations naturally into your response (e.g., "Based on the Introduction section of iso27001.pdf..."). Do not print raw internal label strings.
    - Rely strictly on the explicit facts provided in the context blocks. 
    - 🛡️ REVISED GUARDRAIL: If the provided context blocks do not contain the answer or are entirely irrelevant to the question, reply exactly with: "INSUFFICIENT_INTERNAL_CONTEXT". Do not append this note if you are able to successfully fulfill the answer from the text.
    - Do not assume, guess, or reference outside world knowledge.
    - Keep your response professional, precise, and structured.

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
      stream: true,
    });

    // 5. STREAM PIPING: Yield tokens through the loop handler the moment they compile
    for await (const chunk of responseStream) {
      const token = chunk.message.content;
      if (token) {
        tokenCallback(token);
      }
    }

    console.log(`\n✅ [LLM] Real-time text production stream safely closed.`);

  } catch (error) {
    console.error('❌ Critical failure in AI streaming layer:', error.message);
    throw error;
  }
}
