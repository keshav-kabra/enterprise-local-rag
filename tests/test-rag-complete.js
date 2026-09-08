import dotenv from 'dotenv';
import { generateStreamingRAGResponse } from '../src/services/llm.js';

dotenv.config();

async function runEndToEndRAGCheck() {
  console.log('\n======================================================================');
  console.log('🚀 SYSTEM INTEGRATION TEST: Executing End-to-End Local RAG Engine...');
  console.log('======================================================================');

  const targetedQuestion = "Who is the primary contact for escalating architecture permissions?";
  
  console.log(`🙋 Question Asked: "${targetedQuestion}"`);
  console.log('\n🤖 Streaming Singular AI Response from Local Hardware:\n----------------------------------------------------------------------');

  try {
    // Invoke the orchestrator service layer. 
    // The second parameter is our word handler callback.
    await generateStreamingRAGResponse(targetedQuestion, (characterToken) => {
      // process.stdout.write prints characters right next to each other 
      // without adding newlines, giving you a smooth typing effect.
      process.stdout.write(characterToken); 
    });

  } catch (error) {
    console.error('\n❌ End-to-end processing pipeline crashed:', error);
  } finally {
    console.log('\n----------------------------------------------------------------------');
    console.log('======================================================================\n');
    process.exit(0);
  }
}

// Give system connections a brief 1-second buffer handshake window before execution
setTimeout(runEndToEndRAGCheck, 1000);
