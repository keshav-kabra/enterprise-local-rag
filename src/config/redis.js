import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Standard connection options matching your Docker environment
const redisConfig = {
  maxRetriesPerRequest: null, // Critical requirement enforced by BullMQ
};

export const redisConnection = new Redis(process.env.REDIS_URL, redisConfig);

redisConnection.on('connect', () => {
  console.log('✅ Connected to Redis cache for background queues.');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err);
});
