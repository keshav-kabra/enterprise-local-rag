-- Delta Update: Expand metadata tracking columns on chunks
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS heading TEXT,
ADD COLUMN IF NOT EXISTS section TEXT;
