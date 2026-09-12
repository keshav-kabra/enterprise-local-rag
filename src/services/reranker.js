import { AutoTokenizer, AutoModelForSequenceClassification, env } from '@huggingface/transformers';

env.cacheDir = './.cache'; 

let tokenizerInstance = null;
let modelInstance = null;

/**
 * Initializes and caches the raw tokenizer and model heads independently,
 * completely bypassing the buggy pipeline wrappers.
 */
async function loadRerankerEngine() {
  if (!tokenizerInstance || !modelInstance) {
    console.log('⏳ [Reranker Infrastructure] Initializing raw Cross-Encoder heads (Xenova/ms-marco-MiniLM-L-6-v2)...');
    
    tokenizerInstance = await AutoTokenizer.from_pretrained('Xenova/ms-marco-MiniLM-L-6-v2');
    modelInstance = await AutoModelForSequenceClassification.from_pretrained('Xenova/ms-marco-MiniLM-L-6-v2');
    
    console.log('✅ [Reranker Infrastructure] Raw model heads successfully mounted to Node thread.');
  }
  return { tokenizer: tokenizerInstance, model: modelInstance };
}

/**
 * Evaluates candidates using high-speed parallel batch matrix inference over the model's classification head
 */
export async function computeLocalCrossEncoderRerank(query, candidates) {
  if (!candidates || candidates.length === 0) return [];
  
  const { tokenizer, model } = await loadRerankerEngine();
  
  console.log(`🧠 [Reranker Head] Computing parallel batch forward-pass over ${candidates.length} chunks...`);

  try {
    // 🚀 BATCH OPTIMIZATION: Map queries and contents into parallel arrays
    const queriesArray = new Array(candidates.length).fill(query);
    const contentsArray = candidates.map(item => item.content);

    // Tokenize everything at once using a unified matrix layout
    const batchInputs = await tokenizer(queriesArray, {
      text_pair: contentsArray,
      padding: true,      // Required for batch inputs to align dimensions
      truncation: true,
      max_length: 512
    });

    // Run a single parallelized forward pass through the classification model
    const outputs = await model(batchInputs);

    // Extract the raw logit scores from the output tensor data matrix
    // ms-marco-MiniLM-L-6-v2 outputs a single score logit per row pair layout
    const scores = outputs.logits.data;

    const scoredCandidates = candidates.map((item, idx) => ({
      ...item,
      rerankScore: parseFloat(scores[idx])
    }));

    // Sort candidates descending based on their raw verification scores
    return scoredCandidates.sort((a, b) => b.rerankScore - a.rerankScore);

  } catch (err) {
    console.error(`❌ Parallel batch classification pass failed, falling back to safe defaults:`, err.message);
    
    // Fail-safe: Return candidates with a flat baseline score if matrix multiplication crashes
    return candidates.map(item => ({ ...item, rerankScore: -99 }));
  }
}
