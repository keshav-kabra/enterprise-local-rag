import { Queue } from 'bullmq';
import { redisConnection } from './redis.js';

// Define the name of our background job pipeline
export const INGESTION_QUEUE_NAME = 'document-ingestion-queue';

// Instantiate the queue instance
export const ingestionQueue = new Queue(INGESTION_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    // Senior Production Practice: Configure automatic failure handling
    attempts: 3, 
    backoff: {
      type: 'exponential',
      delay: 5000, // Wait 5s, then 10s, then 20s before giving up
    },
    removeOnComplete: true, // Auto-clean Redis memory on success
    removeOnFail: false,    // Keep failed jobs for debugging/inspection
  },
});

console.log(`🚀 BullMQ '${INGESTION_QUEUE_NAME}' initialized.`);
