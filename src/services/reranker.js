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
 * Evaluates candidates using direct forward-pass matrix inference over the model's classification head
 */
export async function computeLocalCrossEncoderRerank(query, candidates) {
  if (!candidates || candidates.length === 0) return [];
  
  const { tokenizer, model } = await loadRerankerEngine();
  const scoredCandidates = [];
  
  console.log(`🧠 [Reranker Head] Computing forward-pass logits over ${candidates.length} chunks...`);

  for (const item of candidates) {
    try {
      // 🚀 THE PRODUCTION-OPTIMIZED FIX: Max length boundary with zero overhead padding
      const inputs = await tokenizer(query, {
        text_pair: item.content,
        truncation: true,
        max_length: 512
      });

      // Execute a raw forward pass through the sequence classification neural network graph
      const outputs = await model(inputs);

      // Extract the absolute scalar float value matching the classification head directly
      const rawLogitScore = outputs.logits.data[0];

      scoredCandidates.push({
        ...item,
        rerankScore: parseFloat(rawLogitScore)
      });
    } catch (err) {
      console.error(`⚠️ Individual chunk forward-pass failed:`, err.message);
      scoredCandidates.push({ ...item, rerankScore: -99 });
    }
  }

  // Sort candidates descending based on their raw, unique classification head scores
  return scoredCandidates.sort((a, b) => b.rerankScore - a.rerankScore);
}
