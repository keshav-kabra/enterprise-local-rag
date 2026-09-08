import dotenv from 'dotenv';
import { ingestionQueue } from './config/queue.js';

dotenv.config();

async function runDiagnostics() {
  console.log('⏳ Running local AI architecture diagnostics...');
  
  try {
    // Add a simple diagnostic verification job to the queue
    const testJob = await ingestionQueue.add('diagnostic-job', {
      timestamp: new Date().toISOString(),
      status: 'testing_redis_handshake'
    });
    
    console.log(`✅ System Handshake Complete. Diagnostic job dispatched to Redis (ID: ${testJob.id})`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Diagnostics failed to communicate with queue:', error);
    process.exit(1);
  }
}

runDiagnostics();
