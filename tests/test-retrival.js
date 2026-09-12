import dotenv from 'dotenv';
import { performSemanticSearch } from '../src/services/retrival.js';
import { pool } from '../src/config/db.js'; // Added database pool import for clean shutdown

dotenv.config();

async function runRetrievalTest() {
  console.log('\n======================================================');
  console.log('🚀 SYSTEM DIAGNOSTIC: Testing Semantic Vector Retrieval...');
  console.log('======================================================');

  // Updated to test your real-world ingested ISO 27001 compliance data
  const targetQuestion = "How Top management shall demonstrate leadership and commitment with respect to the information";
  
  try {
    const matchedChunks = await performSemanticSearch(targetQuestion, 1);

    console.log('\n🎯 RETRIEVAL SEARCH RESULTS (POST RERANK):');
    matchedChunks.forEach((match, index) => {
      // Adjusted property layout strings to fit the updated database rows returned
      console.log(`\n🔹 [Match ${index + 1}] (Model Rerank Score: ${match.rerankScore ? match.rerankScore.toFixed(4) : '0.0000'})`);
      console.log(`   Chunk Index: ${match.chunk_index}`);
      console.log(`   Parent Section Context: "${match.section || 'N/A'}"`);
      console.log(`   Heading Field: "${match.heading || 'N/A'}"`);
      console.log(`   --- FULL TEXT ---`);
      console.log(match.content.trim());
      console.log(`   -----------------`);
    });

    // Smart validation: Check if we successfully grabbed Clause 5.1/5.2 from the text
    const contextContent = matchedChunks.map(m => m.content).join(' ');
    if (contextContent.includes('Leadership and commitment') || contextContent.includes('5.1')) {
      console.log('\n✅ SUCCESS: Vector retrieval + Cross-Encoder successfully surfaced the correct ISO clauses!');
    } else {
      console.log('\n❌ FAILURE: The engine did not capture the target text segments.');
    }

  } catch (error) {
    console.error('❌ Critical retrieval test crash:', error);
  } finally {
    console.log('======================================================\n');
    console.log('🧹 Draining active database connection channels...');
    await pool.end(); // Graceful shutdown to clear Node process hooks
    console.log('👋 Diagnostic complete.');
  }
}

runRetrievalTest();
