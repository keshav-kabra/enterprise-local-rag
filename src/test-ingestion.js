import dotenv from 'dotenv';
import { ingestionQueue } from './config/queue.js';
import { pool } from './config/db.js';

// Senior Architectural Note: Simply importing this file activates the BullMQ 
// background listener, forcing it to consume from the Redis container.
import './workers/ingestionWorker.js'; 

dotenv.config();

async function runValidationTest() {
  console.log('\n======================================================');
  console.log('🚀 SYSTEM DIAGNOSTIC: Testing Optimized Ingestion Pipeline...');
  console.log('======================================================');

  // Realistic company document with distinct themes to test our chunker
  const sampleDocumentContent = `
  OMNIGLIDE CORPORATE RUNBOOK V5 (2026)
  
  Our primary internal routing layer enforces authentication protocols using OAuth2 keys. 
  All inter-service database nodes communicate strictly on Port 8443 inside the VPC.
  
  For caching layers, global storage engines preserve state persistence using containerized Redis 
  clusters. Engineers looking to escalate infrastructure access privileges must coordinate 
  directly with the Systems Engineering Architect, Alex.
  `;

  try {
    // 1. Clean the database tables first so we have a completely clean test grid
    console.log('🧹 Flushing existing tables to ensure clean test parameters...');
    await pool.query('TRUNCATE TABLE document_chunks, documents RESTART IDENTITY CASCADE;');

    // 2. Dispatch the text payload task directly into the Redis queue buffer via BullMQ
    console.log('⏳ Dispatching mock file payload task onto Redis queue buffer...');
    const job = await ingestionQueue.add('diagnostic-ingestion-job', {
      filename: 'omniglide_test_file.txt',
      fileContent: sampleDocumentContent,
      mimeType: 'text/plain',
      fileSize: Buffer.byteLength(sampleDocumentContent),
    });

    console.log(`📦 Task staged in Redis. Job ID: ${job.id}`);
    console.log('👀 Waiting 5 seconds for background worker to process embeddings and insert to Postgres...\n');

    // 3. Pause for 5 seconds to let the background asynchronous process do its work
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 4. Query PostgreSQL to verify that the rows were successfully written
    console.log('\n📊 DATABASE VALIDATION CHECK:');
    
    const docCheck = await pool.query('SELECT * FROM documents;');
    console.log(`🔹 Parent Documents Table Count: ${docCheck.rowCount}`);
    if (docCheck.rowCount > 0) {
      console.log(`   Registered Filename: "${docCheck.rows[0].filename}"`);
    }

    const chunkCheck = await pool.query('SELECT id, chunk_index, content, embedding::text FROM document_chunks;');
    console.log(`🔹 Document Chunks Table Count: ${chunkCheck.rowCount}`);
    
    if (chunkCheck.rowCount > 0) {
      console.log(`\n✅ SUCCESS: Vector data detected in PostgreSQL!`);
      console.log(`👉 Chunk 1 Snippet: "${chunkCheck.rows[0].content.substring(0, 80)}..."`);
      
      // Clean up the long stringified vector to show a small preview snippet
      const vectorSnippet = chunkCheck.rows[0].embedding.substring(0, 45);
      console.log(`📐 Embedding Sample Matrix: ${vectorSnippet}... ] (Expected 768 dimensions)`);
    } else {
      console.log(`❌ FAILURE: Job was queued, but no data records were written to document_chunks.`);
    }

  } catch (error) {
    console.error('❌ Critical diagnostic execution failure:', error);
  } finally {
    // Gracefully disconnect from our connection pool to allow the Node process to exit cleanly
    await pool.end();
    console.log('\n======================================================');
    process.exit(0);
  }
}

// Give Docker containers a brief 1-second buffer window to ensure connection readiness
setTimeout(runValidationTest, 1000);
