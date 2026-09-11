import dotenv from 'dotenv';
import { performAdvancedSearchWithRerank } from '../src/services/retrival.js'; // Keep consistent with your project's filename spelling
import { pool } from '../src/config/db.js'; // Import the db configuration pool directly

dotenv.config();

async function runRerankerTest() {
  console.log('\n======================================================================');
  console.log('🚀 TESTING REAL LOCAL CROSS-ENCODER AI RERANKING');
  console.log('======================================================================');

  const targetQuestion = "How Top management shall demonstrate leadership and commitment with respect to the information";

  try {
    const startTime = Date.now();
    const finalTwoChunks = await performAdvancedSearchWithRerank(targetQuestion, 6); 
    const duration = Date.now() - startTime;

    console.log(`\n⏱️ Pipeline completed in ${duration}ms (including database fetch + cross-encoder math).`);
    console.log('\n🏆 ABSOLUTE PRECISION RERANKED RESULTS:');
    
    if (!finalTwoChunks || finalTwoChunks.length === 0) {
      console.log('⚠️ No chunks returned. Make sure your database tables are populated!');
    }

    finalTwoChunks.forEach((chunk, index) => {
      console.log(`\n🔹 [Top Selection #${index + 1}] (Model Match Score: ${chunk.rerankScore ? chunk.rerankScore.toFixed(4) : '0.0000'})`);
      console.log(`   File: ${chunk.filename} (Chunk Index: ${chunk.chunkIndex})`);
      console.log(`   Text Snippet: "${chunk.content.trim().substring(0, 150)}..."`);
    });

  } catch (err) {
    console.error('❌ Benchmark script crashed:', err);
  } finally {
    console.log('======================================================================\n');
    
    // 🚀 THE GRACEFUL FIX: Close database pools safely and let Node's garbage collector 
    // wind down the ONNX C++ runtime background worker threads naturally, preventing abort errors.
    console.log('🧹 Safely draining active database connection channels...');
    await pool.end(); 
    
    console.log('👋 System diagnostic complete.');
    // REMOVED: process.exit(0) to allow clean asynchronous runtime termination
  }
}

setTimeout(runRerankerTest, 500);
