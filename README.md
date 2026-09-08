# 🛡️ OmniGlide: Enterprise Local RAG Engine

[![Node.js Version](https://shields.io)(https://nodejs.org)]()
[![License: MIT](https://shields.io)](https://opensource.org)
[![Architecture: Local GPU Edge](https://shields.io)]()
[![Security: 100%25 Private](https://shields.io)]()

OmniGlide is a production-grade, self-hosted **Retrieval-Augmented Generation (RAG)** platform built entirely within the **Node.js ecoystem**. It allows organizations with strict data compliance boundaries (e.g., Finance, Healthcare, Legal) to securely ingest, vectorize, and semantically query private corporate documentation without transmitting data to third-party public cloud AI providers.

Every component runs **100% locally** on consumer hardware (optimized for Apple Silicon / M-Series architectures), ensuring zero API costs and absolute data sovereignty.

---

## 🏛️ System Architecture & Workflow

OmniGlide decouples heavy CPU/GPU text processing tasks from the client-facing server using an **event-driven background worker pipeline** to protect the single-threaded Node.js event loop.

```mermaid
graph TD
    %% Styling
    classDef infra fill:#1e293b,stroke:#334155,stroke-width:2px,color:#f8fafc;
    classDef engine fill:#064e3b,stroke:#059669,stroke-width:2px,color:#a7f3d0;
    classDef client fill:#0f172a,stroke:#334155,stroke-width:1px,color:#cbd5e1;

    %% Ingestion Flow
    subgraph "Ingestion Pipeline (Asynchronous)"
        A[User Uploads Content] -->|HTTP POST| B(Fastify Traffic Gateway)
        B -->|Dispatches Payload| C[(Redis Queue Buffer)]:::infra
        C -->|Pulls Job Sequentially| D[BullMQ Processing Worker]:::engine
        D -->|Slices String| E[Space-Aware Text Chunker]
        E -->|Processes Text| F[Local Ollama API: nomic-embed-text]:::engine
        F -->|Yields 768d Matrices| G[PostgreSQL DB: pgvector]:::infra
    end

    %% Query Flow
    subgraph "Semantic Retrieval & Streaming (Real-Time)"
        H[User Types Prompt] -->|HTTP GET /chat| I(Fastify Stream Engine)
        I -->|Vectorizes Query| J[Ollama Embedding Model]:::engine
        J -->|Executes Cosine Search| K[(pgvector HNSW Graph Index)]:::infra
        K -->|Retrieves Relevant Chunks| L[Context Synthesis Layer]
        L -->|Stuffs Prompt Securely| M[Local Ollama API: Llama 3.1 8B]:::engine
        M -->|Pipes Tokens via SSE| I
        I -->|Streams Characters text/event-stream| N[Dark-Themed Chat Dashboard]:::client
    end
```


---

## ⚡ Core Engineering Highlights (Why it Scales)

*   **Non-Blocking Ingestion Worker Loop:** Parsing raw content and mapping multi-dimensional arrays requires significant CPU cycles. OmniGlide uses **BullMQ and Redis** to handle operations asynchronously out-of-process, guaranteeing the core Fastify API never experiences thread starvation.
*   **Batch Insert Optimization (Anti-N+1 Querying):** Rather than performing relational database mutations sequentially inside loops, the background worker leverages PostgreSQL’s native `UNNEST` function to execute a single, highly performant bulk query.
*   **Sub-Millisecond Semantic Retrieval:** Vector columns are indexed using a **Hierarchical Navigable Small World (HNSW)** graph with `vector_cosine_ops` calculation filters, transforming expensive O(N) database scans into sub-millisecond O(log N) operations.
*   **Low-Latency User Experience:** Utilizes native HTTP **Server-Sent Events (SSE)** streaming (`text/event-stream`) to pipe language tokens to the screen character-by-character the moment they compile on the Mac's GPU core, minimizing Time-to-First-Token (TTFT).

---

## 🛠️ Tech Stack & Dependencies

*   **Runtime Framework:** Node.js (v18+) with modern ES Modules configuration.
*   **API Gateway:** Fastify (Exposing low-overhead, asynchronous network hooks).
*   **Task Broker:** BullMQ backed by a high-performance `ioredis` cache connection layer.
*   **Vector Infrastructure:** PostgreSQL container equipped with the open-source native `pgvector` C-extension.
*   **Local AI Core Engine:** Ollama running localized `llama3.1` (8B Chat Model) and `nomic-embed-text` (768-dimensional text embedding model).
*   **User Interface:** Pure static HTML5 dashboard utilizing interactive layouts and Tailwind CSS styling configurations.

---

## 🚀 Local Deployment Setup

Ensure you have **Docker Desktop** and the **Ollama** application running locally on your machine before setup.

### 1. Provision Model Dependencies
Download the target neural architectures via your terminal:
```bash
ollama pull llama3.1
ollama pull nomic-embed-text
```

### 2. Configure Environment Configurations
Create a `.env` file in your root folder:
```env
PORT=3000
DATABASE_URL=postgres://rag_admin:secure_rag_password@localhost:5432/enterprise_knowledge_db
REDIS_URL=redis://localhost:6379
OLLAMA_HOST=http://localhost:11434
```

### 3. Spin Up Infrastructure Containers
Use Docker Compose to provision the containerized data environments:
```bash
docker compose up -d
```

### 4. Initialize Database Schemas & HNSW Graphs
Install local runtime modules and apply the SQL indexes:
```bash
npm install
npm run db:migrate
```

### 5. Boot Up Server & Test Workspaces
Launch the hot-reloading native watcher development engine:
```bash
npm run dev
```
Navigate your browser to 👉 **`http://localhost:3000`** to interact with the responsive dashboard interface!

---

## 📋 Repository Structure
```text
├── src/
│   ├── api/          # Fastify routing layers & request schemas
│   ├── config/       # Connection engines (PostgreSQL, Redis)
│   ├── db/           # SQL migration definitions & table configurations
│   ├── public/       # Front-end asset layers (index.html Dashboard)
│   ├── services/     # AI Pipeline Core (Chunking, Embeddings, RAG Loop)
│   ├── workers/      # BullMQ Background Process Daemon Task Handlers
│   └── app.js        # Main initialization entry hook script
├── tests/            # Local discrete automated integration test workflows
├── docker-compose.yml# Container infrastructure layer specifications
└── package.json
```
