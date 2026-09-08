export class TechnicalTextSplitter {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 500;    
    this.chunkOverlap = options.chunkOverlap || 50; 
  }

  splitText(text) {
    if (!text || typeof text !== 'string') return [];

    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      // If the remaining characters are completely within our chunkSize window,
      // grab everything left and immediately break out of the loop.
      if (currentIndex + this.chunkSize >= text.length) {
        const finalChunk = text.substring(currentIndex).trim();
        if (finalChunk.length > 0) chunks.push(finalChunk);
        break; // Clean exit, preventing trailing duplicates!
      }

      let endIndex = currentIndex + this.chunkSize;

      // Clean space checking for normal text limits
      const lookaheadWindow = text.substring(endIndex - 20, endIndex + 20);
      const lastSpace = lookaheadWindow.lastIndexOf(' ');
      if (lastSpace !== -1) {
        endIndex = (endIndex - 20) + lastSpace;
      }

      const chunk = text.substring(currentIndex, endIndex).trim();
      if (chunk.length > 0) chunks.push(chunk);

      currentIndex = endIndex - this.chunkOverlap;
    }

    return chunks;
  }
}
