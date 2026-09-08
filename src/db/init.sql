-- 1. Enable the pgvector extension natively in this database
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Drop existing tables if they exist (for clean migrations during local development)
DROP TABLE IF EXISTS document_chunks;
DROP TABLE IF EXISTS documents;

-- 3. Parent table to track the uploaded files metadata
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_size_bytes INT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Core RAG table storing the actual text slices and their vectors
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    -- 768 dimensions maps perfectly to the 'nomic-embed-text' model vector layout
    embedding vector(768), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Senior Engineering Touch: Create an HNSW Index for production retrieval speeds
-- We use cosine similarity (vector_cosine_ops) as it is standard for text embeddings
CREATE INDEX IF NOT EXISTS document_chunks_hnsw_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);
