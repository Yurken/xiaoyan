-- Research Copilot Database Schema
-- Run this once to set up the database

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Research interests / directions
CREATE TABLE IF NOT EXISTS research_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic VARCHAR(300) NOT NULL,
    keywords JSONB DEFAULT '[]',
    learning_path JSONB,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Papers
CREATE TABLE IF NOT EXISTS papers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    authors TEXT,
    abstract TEXT,
    year INTEGER,
    venue VARCHAR(300),
    doi VARCHAR(200),
    file_path VARCHAR(500),
    full_text TEXT,
    tags JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Paper text chunks with vector embeddings
CREATE TABLE IF NOT EXISTS paper_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    token_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper_id ON paper_chunks(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_chunks_embedding ON paper_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Paper AI analyses
CREATE TABLE IF NOT EXISTS paper_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID NOT NULL UNIQUE REFERENCES papers(id) ON DELETE CASCADE,
    research_question TEXT,
    core_method TEXT,
    experiment_design TEXT,
    innovations TEXT,
    limitations TEXT,
    key_conclusions TEXT,
    raw_analysis JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reproduction guides
CREATE TABLE IF NOT EXISTS reproduction_guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID NOT NULL UNIQUE REFERENCES papers(id) ON DELETE CASCADE,
    environment_setup TEXT,
    dependencies TEXT,
    dataset_preparation TEXT,
    training_process TEXT,
    inference_process TEXT,
    evaluation_metrics TEXT,
    risks_and_notes TEXT,
    raw_guide JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge base notes
CREATE TABLE IF NOT EXISTS knowledge_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    research_interest_id UUID REFERENCES research_interests(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    source_type VARCHAR(50) DEFAULT 'manual',
    source_id VARCHAR(200),
    tags JSONB DEFAULT '[]',
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_notes_embedding ON knowledge_notes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_title ON knowledge_notes USING gin(to_tsvector('simple', title));

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(300) DEFAULT 'New Conversation',
    context_type VARCHAR(50) DEFAULT 'general',
    context_id VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
