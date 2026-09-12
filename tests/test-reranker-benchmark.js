import dotenv from 'dotenv';
import { performSemanticSearch } from '../src/services/retrival.js'; // Updated named function import
import { pool } from '../src/config/db.js'; 

dotenv.config();

async function runRerankerTest() {
  console.log('\n======================================================================');
  console.log('🚀 TESTING REAL LOCAL CROSS-ENCODER AI RERANKING');
  console.log('======================================================================');

  const targetQuestion = "How Top management shall demonstrate leadership and commitment with respect to the information";

  try {
    const startTime = Date.now();
    // Querying for top matching chunks
    const finalTwoChunks = await performSemanticSearch(targetQuestion, 6); 
    const duration = Date.now() - startTime;

    console.log(`\n⏱️ Pipeline completed in ${duration}ms (including database fetch + cross-encoder math).`);
    console.log('\n🏆 ABSOLUTE PRECISION RERANKED RESULTS:');
    
    if (!finalTwoChunks || finalTwoChunks.length === 0) {
      console.log('⚠️ No chunks returned. Make sure your database tables are populated!');
    }

        finalTwoChunks.forEach((chunk, index) => {
      console.log(`\n🔹 [Top Selection #${index + 1}] (Model Match Score: ${chunk.rerankScore ? chunk.rerankScore.toFixed(4) : '0.0000'})`);
      console.log(`   File: ${chunk.filename} (Chunk Index: ${chunk.chunk_index})`);
      console.log(`   Parent Section Context: "${chunk.section || 'N/A'}"`);
      console.log(`   --- FULL RETRIEVED TEXT BLOCK ---`);
      console.log(chunk.content.trim()); // 🚀 REMOVED THE 150 CHARACTER SUBSTRING LIMIT
      console.log(`   ---------------------------------`);
    });


  } catch (err) {
    console.error('❌ Benchmark script crashed:', err);
  } finally {
    console.log('======================================================================\n');
    
    console.log('🧹 Safely draining active database connection channels...');
    await pool.end(); 
    
    console.log('👋 System diagnostic complete.');
  }
}

setTimeout(runRerankerTest, 500);
