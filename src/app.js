import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fastifyStatic from '@fastify/static';
import { apiRoutes } from './api/routes.js';

import './workers/ingestionWorker.js'; 

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: false });

// Register the static plugin to look inside src/public for asset files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/', 
});

fastify.register(apiRoutes, { prefix: '/api' });

const startServer = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 Fastify Enterprise RAG Dashboard running on http://localhost:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

startServer();
