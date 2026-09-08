import Fastify from 'fastify';
import dotenv from 'dotenv';
import { apiRoutes } from './api/routes.js';

// Auto-boots the BullMQ queue worker connection background long-poll
import './workers/ingestionWorker.js'; 

dotenv.config();

const fastify = Fastify({ logger: false }); // Turn off noisy logging for cleaner console views

// Register our routing middleware
fastify.register(apiRoutes, { prefix: '/api' });

const startServer = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 Fastify Enterprise RAG Engine running on http://localhost:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

startServer();
