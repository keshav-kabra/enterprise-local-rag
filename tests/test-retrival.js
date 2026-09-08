import dotenv from 'dotenv';
import { performSemanticSearch } from '../src/services/retrival.js';

dotenv.config();

async function runRetrievalTest() {
  console.log('\n======================================================');
  console.log('🚀 SYSTEM DIAGNOSTIC: Testing Semantic Vector Retrieval...');
  console.log('======================================================');

  // We ask a conceptual question based on the document we ingested earlier
  const conceptualQuestion = "Who is the primary contact for escalating architecture permissions?";
  
  try {
    const matchedChunks = await performSemanticSearch(conceptualQuestion, 2);

    console.log('\n🎯 RETRIEVAL SEARCH RESULTS:');
    matchedChunks.forEach((match, index) => {
      console.log(`\n🔹 [Match ${index + 1}] (Similarity Score: ${match.similarity})`);
      console.log(`   Chunk Index: ${match.chunkIndex}`);
      console.log(`   Text Snippet: "${match.content.trim()}"`);
    });

    if (matchedChunks.length > 0 && matchedChunks[0].content.includes('Alex')) {
      console.log('\n✅ SUCCESS: Vector math successfully retrieved the correct context segment!');
    } else {
      console.log('\n❌ FAILURE: The engine did not find the correct text chunks matching the prompt.');
    }

  } catch (error) {
    console.error('❌ Critical retrieval test crash:', error);
  } finally {
    console.log('======================================================\n');
    process.exit(0);
  }
}

runRetrievalTest();
