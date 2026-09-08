import { ingestionQueue } from '../config/queue.js';
import { generateStreamingRAGResponse } from '../services/llm.js';

export async function apiRoutes(fastify, options) {
  
  // Health Check
  fastify.get('/health', async (request, reply) => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // Asynchronous Ingestion (From earlier step)
  fastify.post('/v1/ingest', async (request, reply) => {
    const { filename, content } = request.body || {};
    if (!filename || !content) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Missing parameters.' });
    }

    const job = await ingestionQueue.add('api-triggered-ingestion', {
      filename,
      fileContent: content,
      mimeType: 'text/plain',
      fileSize: Buffer.byteLength(content),
    });

    return reply.status(202).send({ success: true, jobId: job.id });
  });

  // 🚀 NEW: Advanced Real-Time Chat Query Endpoint using Server-Sent Events (SSE)
  fastify.get('/v1/chat', async (request, reply) => {
    const { question } = request.query;

    if (!question) {
      return reply.status(400).send({ error: 'Missing question query parameter.' });
    }

    // Set HTTP headers for Server-Sent Events streaming
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*', // Allows frontend UI to connect safely
    });

    try {
      // Stream tokens from our LLM service straight down the network pipe
      await generateStreamingRAGResponse(question, (token) => {
        // SSE formatting requires prefixing data chunks with "data: " and ending with double newlines
        reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
      });

      // Signal to the browser that the AI has finished its generation loop cleanly
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();

    } catch (error) {
      fastify.log.error('Streaming failure:', error.message);
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
        reply.raw.end();
      }
    }
  });
}
