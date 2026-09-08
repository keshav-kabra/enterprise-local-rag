import { TechnicalTextSplitter } from './services/textsplitter.js';
import { generateEmbedding } from './services/embedding.js';

async function testAIServices() {
  console.log('⏳ Running Text Processing and Embedding Model diagnostics...');

  // Mocking a long company document string
  const corporateRunbookSample = `
  SECURITY INSTRUCTION: All developers must rotate their private SSH keys every 90 days. 
  Production server access is strictly restricted to secure bastions operating on Port 2244. 
  Failure to follow these protocols will trigger an automated lock from the central SecOps firewall. 
  The primary contact for infrastructure keys is the Devops Lead, Sarah.
  `;

  // 1. Execute text slicing logic
  const splitter = new TechnicalTextSplitter({ chunkSize: 150, chunkOverlap: 20 });
  const textChunks = splitter.splitText(corporateRunbookSample);
  
  console.log(`\n✂️ Document segmented successfully into [${textChunks.length}] chunks.`);
  textChunks.forEach((chunk, index) => {
    console.log(`   [Chunk ${index + 1}]: "${chunk}"`);
  });

  // 2. Pass the very first chunk down to local Ollama hardware to test embedding math
  try {
    console.log('\n🤖 Sending Chunk 1 down to local Ollama (nomic-embed-text)...');
    const vector = await generateEmbedding(textChunks[0]);
    
    console.log('✅ Embedding successful vector response intercepted!');
    console.log(`📐 Vector Dimensions: ${vector.length} floats (Expected: 768)`);
    console.log(`📊 Sample Vector Data Matrix: [${vector.slice(0, 5).join(', ')}, ...]`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Diagnostic test failed:', err);
    process.exit(1);
  }
}

testAIServices();
