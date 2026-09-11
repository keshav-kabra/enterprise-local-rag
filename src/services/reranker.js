import { pipeline, env } from '@huggingface/transformers';

// Explicitly route local caching models right to our visible workspace folder
env.cacheDir = './.cache'; 

let rerankPipelineInstance = null;

async function getRerankerPipeline() {
  if (!rerankPipelineInstance) {
    console.log('⏳ [Reranker Model] Mounting High-Precision Cross-Encoder (Xenova/ms-marco-MiniLM-L-6-v2)...');
    
    rerankPipelineInstance = await pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2', {
      progress_callback: (info) => {
        if (info.status === 'downloading') {
          const loaded = info.loaded || 0;
          const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
          
          if (info.total) {
            const percent = ((loaded / info.total) * 100).toFixed(1);
            const totalMB = (info.total / (1024 * 1024)).toFixed(1);
            process.stdout.write(`   📥 Streaming weights: ${percent}% (${loadedMB}MB / ${totalMB}MB)\r`);
          } else {
            process.stdout.write(`   📥 Streaming weights: ${loadedMB}MB written...\r`);
          }
        } else if (info.status === 'done') {
          console.log(`   ✅ File locked to local cache: ${info.file}                                `);
        }
      }
    });
    console.log('\n✅ [Reranker Model] Cross-Encoder model loaded successfully.');
  }
  return rerankPipelineInstance;
}

export async function computeLocalCrossEncoderRerank(query, candidates) {
  if (!candidates || candidates.length === 0) return [];
  
  const classifier = await getRerankerPipeline();
  const scoredCandidates = [];
  
  console.log(`🧠 [Reranker Model] Running cross-attention matrices over ${candidates.length} chunks...`);

  for (const item of candidates) {
    try {
      // Cross-Encoder array format: [Query, Document Context Chunk Text]
      const response = await classifier([query, item.content]);

      // Transformers v2 text-classification outputs an array: [{ label: 'LABEL_0', score: 0.942 }]
      const alignmentScore = response[0]?.score || 0;

      scoredCandidates.push({
        ...item,
        rerankScore: parseFloat(alignmentScore)
      });
    } catch (err) {
      console.error(`⚠️ Individual chunk rerank trace dropped:`, err.message);
      scoredCandidates.push({ ...item, rerankScore: 0 });
    }
  }

  return scoredCandidates.sort((a, b) => b.rerankScore - a.rerankScore);
}
