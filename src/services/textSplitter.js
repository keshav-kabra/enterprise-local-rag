export class TechnicalTextSplitter {
  constructor(options = {}) {
    // Keeping your default values, but tracking strict safe absolute text capacities
    this.chunkSize = options.chunkSize || 1200;    
    this.chunkOverlap = options.chunkOverlap || 150; 
    
    // 🛡️ Ollama Safety: Prevent huge text anomalies from hitting embedding contexts
    this.absoluteMaxChars = options.absoluteMaxChars || 2000; 
  }

  splitText(text) {
    if (!text || typeof text !== 'string') return [];

    const chunks = [];
    
    // 1. Normalize line endings and break text down into natural paragraphs
    const paragraphs = text.split(/\r?\n\s*\r?\n/);
    
    let currentChunkText = "";
    let activeHeading = "Document Start";
    let activeSection = "Introduction";

    // Regular expressions to identify standard technical markdown or plaintext headers
    const headingRegex = /^(?:[#\-\=\*\_]{2,}\s*)?(?:(?:Section|Chapter|Clause)\s+\d+|(?:\d+\.)+\d*|\b[A-Z][A-Z\s]{3,}\b)(?:\:|\.|\s|$)/i;

    for (let paragraph of paragraphs) {
      paragraph = paragraph.trim();
      if (!paragraph) continue;

      // Ensure a single massive paragraph cannot bypass your embedding model single-handedly
      if (paragraph.length > this.absoluteMaxChars) {
        paragraph = paragraph.substring(0, this.absoluteMaxChars);
      }

      // 2. Structural Boundary Assessment: Check if this paragraph behaves as a major heading
      if (paragraph.length < 120 && headingRegex.test(paragraph)) {
        if (currentChunkText.trim().length > 0) {
          chunks.push({
            content: currentChunkText.trim().substring(0, this.absoluteMaxChars),
            heading: activeHeading,
            section: activeSection
          });
          
          currentChunkText = currentChunkText.slice(-this.chunkOverlap);
        }
        
        activeHeading = paragraph;
        activeSection = paragraph.replace(/^[#\-\*\s\=]+|[#\-\*\s\=]+$/g, '').trim(); 
        
        currentChunkText += (currentChunkText ? "\n\n" : "") + paragraph;
        continue;
      }

      // 3. Structural List & Sentence Boundary Splitting for overflow protection
      if ((currentChunkText + "\n\n" + paragraph).length > this.chunkSize) {
        
        // 🚀 UPGRADED REGEX: Splits cleanly by standard sentence ends (.!?) OR sub-list items (e.g., ; followed by newline)
        const sentences = paragraph.split(/(?<=[.!?])\s+|\n(?=[a-z]\))/);

        for (const sentence of sentences) {
          if ((currentChunkText + " " + sentence).length > this.chunkSize) {
            if (currentChunkText.trim().length > 0) {
              chunks.push({
                content: currentChunkText.trim().substring(0, this.absoluteMaxChars),
                heading: activeHeading,
                section: activeSection
              });
              currentChunkText = currentChunkText.slice(-this.chunkOverlap);
            }
          }
          currentChunkText += (currentChunkText ? "\n" : "") + sentence;
        }
      } else {
        currentChunkText += (currentChunkText ? "\n\n" : "") + paragraph;
      }

    }

    // 4. Final Flush: Commit remaining data safely
    if (currentChunkText.trim().length > 0) {
      chunks.push({
        content: currentChunkText.trim().substring(0, this.absoluteMaxChars),
        heading: activeHeading,
        section: activeSection
      });
    }

    return chunks;
  }
}
