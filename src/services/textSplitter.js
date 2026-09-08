/**
 * Custom Text Splitter optimized for LLM Context Window Constraints
 * Implements standard recursive sliding-window logic with character overlaps.
 */
export class TechnicalTextSplitter {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 500;    // Target length of characters per chunk
    this.chunkOverlap = options.chunkOverlap || 50; // Context bridge overlap between chunks
  }

  /**
   * Slices a raw continuous string into arrays of overlapping chunks
   * @param {string} text - The raw text extracted from a corporate document
   * @returns {Array<string>} Array of optimally sized text chunks
   */
  splitText(text) {
    if (!text || typeof text !== 'string') return [];

    const chunks = [];
    let currentIndex = 0;

    // Standard high-performance sliding window mechanism
    while (currentIndex < text.length) {
      // Calculate the endpoint boundary for the current text slice
      let endIndex = currentIndex + this.chunkSize;

      // Senior Practice: Avoid cutting sentences cleanly in half if possible.
      // If we aren't at the very end of the text, look for the nearest natural paragraph or sentence break
      if (endIndex < text.length) {
        const remainingTextSlice = text.substring(currentIndex, endIndex + 50); // lookahead window
        const naturalBreak = remainingTextSlice.lastIndexOf('\n') !== -1 
          ? remainingTextSlice.lastIndexOf('\n') 
          : remainingTextSlice.lastIndexOf('. ');

        // Adjust index boundary if a natural punctuation anchor point is found nearby
        if (naturalBreak > this.chunkSize - 100) {
          endIndex = currentIndex + naturalBreak + 1;
        }
      }

      // Extract the final slice and trim unwanted white space padding
      const chunk = text.substring(currentIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Slide the current text scanner window forward, accounting for context overlapping
      currentIndex = endIndex - this.chunkOverlap;
      
      // Safety fail-safe: Force advance if overlap configuration stalls calculation loops
      if (currentIndex >= endIndex) {
        currentIndex = endIndex;
      }
    }

    return chunks;
  }
}
