import { ingestionQueue } from '../config/queue.js';
import { generateStreamingRAGResponse } from '../services/llm.js';
import pdfParse from 'pdf-parse-fork'; // Import the PDF extraction utility

export async function apiRoutes(fastify, options) {
  
  fastify.get('/health', async (request, reply) => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // 🚀 UPGRADED: Real Binary File Ingestion Gateway Endpoint
  fastify.post('/v1/ingest', async (request, reply) => {
    // Check if the incoming request is actually a multipart form upload
    if (!request.isMultipart()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Multipart form-data expected.' });
    }

    try {
      // Stream the file metadata and data buffer out of the HTTP connection socket
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'Bad Request', message: 'No file data chunk intercepted.' });
      }

      const filename = data.filename;
      const mimeType = data.mimetype;
      
      // Read the incoming binary stream directly into a single in-memory buffer array
      const fileBuffer = await data.toBuffer();
      const fileSize = fileBuffer.length;
      
      let extractedText = '';

      console.log(`📂 [API] Intercepted raw upload: ${filename} (${mimeType})`);

      // 🔍 Routing Logic: Parse data appropriately depending on file type extension
      if (mimeType === 'application/pdf') {
        console.log(`📄 [API] Extracting text characters from PDF structure...`);
        const pdfData = await pdfParse(fileBuffer);
        extractedText = pdfData.text;
      } else {
        // Fallback for standard .txt or .md files
        extractedText = fileBuffer.toString('utf8');
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return reply.status(422).send({ 
          error: 'Unprocessable Entity', 
          message: 'Failed to extract printable text from file. Ensure the PDF is not an un-OCRed scanned image.' 
        });
      }

      // Offload the clean text data straight to our optimized background thread queue
      const job = await ingestionQueue.add('file-ingestion-job', {
        filename,
        fileContent: extractedText,
        mimeType,
        fileSize,
      });

      return reply.status(202).send({
        success: true,
        message: 'File text content extracted and enqueued into background pipeline.',
        jobId: job.id
      });

    } catch (error) {
      fastify.log.error('Binary ingestion failure:', error.message);
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });

  // Streaming Chat query route (remains untouched, working perfectly)
  fastify.get('/v1/chat', async (request, reply) => {
    const { question } = request.query;
    if (!question) return reply.status(400).send({ error: 'Missing question query.' });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      await generateStreamingRAGResponse(question, (token) => {
        reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
      });
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (error) {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Stream failure' })}\n\n`);
        reply.raw.end();
      }
    }
  });
}