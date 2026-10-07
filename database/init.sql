-- ============================================================
-- BSRU Student Portal & AI Chatbot — Database Initialization
-- ============================================================

-- 1. Enable pgvector extension for RAG vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Verification Comment
COMMENT ON EXTENSION vector IS 'pgvector extension for storing vector embeddings and similarity search';
