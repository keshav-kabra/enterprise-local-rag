# 🛡️ OmniGlide: Enterprise Local Two-Stage RAG Engine

[![Node.js Version](https://shields.io)](https://nodejs.org)
[![License: MIT](https://shields.io)](https://opensource.org)
[![Architecture: Local GPU Edge](https://shields.io)]()
[![Security: 100%25 Private](https://shields.io)]()

OmniGlide is a production-grade, self-hosted **Retrieval-Augmented Generation (RAG)** platform built entirely within the **Node.js ecosystem**. It allows organizations with strict data compliance boundaries (e.g., Finance, Healthcare, Legal) to securely ingest, vectorize, rerank, and semantically query private corporate documentation without transmitting data to third-party public cloud AI providers.

Every component runs **100% locally** on consumer hardware (optimized for Apple Silicon / M-Series architectures), ensuring zero API costs and absolute data sovereignty.

---

## 🏛️ System Architecture & Workflow

OmniGlide decouples heavy CPU/GPU text processing tasks from the client-facing server using an **event-driven background worker pipeline** to protect the single-threaded Node.js event loop. It implements a sophisticated **Two-Stage Retrieval Pipeline** combining high-recall vector lookups with high-precision neural reranking.

```mermaid
graph TD
    %% Styling
    classDef infra fill:#1e293b,stroke:#334155,stroke-width:2px,color:#f8fafc;
    classDef engine fill:#064e3b,stroke:#059669,stroke-width:2px,color:#a7f3d0;
    classDef client fill:#0f172a,stroke:#334155,stroke-width:1px,color:#cbd5e1;

    %% Ingestion Flow
    subgraph "Ingestion Pipeline (Asynchronous)"
        A[User Uploads Content] -->|HTTP POST Multipart| B(Express Traffic Gateway)
        B -->|Dispatches Payload| C[(Redis Queue Buffer)]:::infra
        C -->|Pulls Job Sequentially| D[BullMQ Processing Worker]:::engine
        D -->|Regex Cleaning & Artifact Strip| E[Structure-Aware Chunker]
        E -->|Processes Text Block Objects| F[Local Ollama API: nomic-embed-text]:::engine
        F -->|Yields 768d Matrices| G[PostgreSQL DB: pgvector + Metadata]:::infra
    end

    %% Query Flow
    subgraph "Two-Stage Retrieval & Streaming (Real-Time)"
        H[User Types Prompt] -->|HTTP GET /chat| I(Express Stream Engine)
        I -->|Vectorizes Query| J[Ollama Embedding Model]:::engine
        J -->|Executes Cosine Search| K[(pgvector HNSW Graph Index)]:::infra
        K -->|Stage 1: Returns Top 10 Recall Chunks| L[Hugging Face Local Cross-Encoder]:::engine
        L -->|Stage 2: Parallel Batch Forward-Pass Logits| M[Context Synthesis Layer]
        M -->|Stuffs Metadata + Chunks into Prompt| N[Local Ollama API: Llama 3]:::engine
        N -->|Pipes Tokens via SSE| I
        I -->|Streams Raw Text Stream| O[Dark-Themed Chat Dashboard]:::client
    end
```

---

## ⚡ Core Engineering Highlights (Why it Scales)

*   **Two-Stage High-Precision Retrieval:** Combines the lightning-fast candidate retrieval speeds of a Bi-Encoder (`pgvector` HNSW graph lookup) with a secondary localized **Cross-Encoder Model (`Xenova/ms-marco-MiniLM-L-6-v2`)**. This architecture runs query-document attention simultaneously, preserving structural listing priorities (e.g., ISO 27001 clauses) and boosting accuracy.
*   **Parallel Neural Batch Optimization:** Bypasses sequential asynchronous loops inside Node runtime paths by mapping retrieval matrices into a single tensor evaluation call. This utilizes **WASM/SIMD hardware acceleration threads**, evaluating all candidates concurrently and dropping reranking latency to **347ms** (an ~80% speedup).
*   **Structure-Aware Boundary Chunking:** Upgraded from blind character splitters to a regex lookahead parser (`(?<=[.!?])\s+|\n(?=[a-z]\))`) that respects section headers, multi-tiered compliance list items, and paragraph boundaries. It automatically passes parent section context down as metadata to prevent context clipping.
*   **Chronological Database Migration Ledger:** Features an automated, incremental database patch system driven by a custom `migrate.js` script and a persistent `schema_migrations` tracking table. This decouples dynamic runtime table updates from static `init.sql` environment rebuilds.
*   **Non-Blocking Micro-Batching (Anti-Backpressure):** The background BullMQ worker enforces a micro-batch step size of 4 during vector creation. This throttles request loads against Ollama background servers, eliminating network timeouts and memory thread leaks during massive uploads.

---

## 🛠️ Tech Stack & Dependencies

*   **Runtime Framework:** Node.js (v18+) with modern ES Modules configuration.
*   **API Framework:** Express (Exposing streaming endpoints and handling multipart files).
*   **Task Broker:** BullMQ backed by a high-performance Redis cache connection layer.
*   **Vector Infrastructure:** PostgreSQL container equipped with the native open-source `pgvector` extension.
*   **Neural Reranker Head:** `@huggingface/transformers` executing local ONNX classification forward-passes.
*   **Local AI Core Engine:** Ollama running localized `llama3` (8B Chat) and `nomic-embed-text` (768d vector model).
*   **User Interface:** Pure HTML5/JavaScript dashboard using Tailwind CSS and native EventSource stream channels.

---

## 🚀 Local Deployment Setup

Ensure you have **Docker Desktop** and the **Ollama** application running locally on your machine before setup.

### 1. Provision Model Dependencies
Download the target neural architectures via your terminal:
```bash
ollama pull llama3
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

### 4. Initialize Database Schemas & Incremental Migrations
Install local runtime modules and apply the chronological SQL changes:
```bash
npm install
node db/migrate.js
```

### 5. Boot Up Server & Test Workspaces
Launch the server environment:
```bash
npm run dev
```
Navigate your browser to 👉 **`http://localhost:3000`** to interact with the responsive dashboard interface!

---

## 📋 Repository Structure
```text
├── db/               # SQL base schema blueprint, incremental migrations, & ledger scripts
│   ├── migrations/   # Delta update script folder (.sql patches)
│   ├── init.sql      # Database initialization setup
│   └── migrate.js    # Chronological migration runner log engine
├── src/
│   ├── config/       # Connection engines (PostgreSQL, Redis)
│   ├── public/       # Front-end asset layers (index.html, main.js Dashboard)
│   ├── services/     # AI Pipeline Core (Chunking, Embeddings, Reranker, RAG Loop)
│   └── workers/      # BullMQ Background Process Ingestion Handlers
├── tests/            # Local discrete automated integration and retrieval benchmark test scripts
├── docker-compose.yml# Container infrastructure configuration file
└── package.json
```

---

## 🏆 Production Debugging Chronicles: *The Dead-Code Cleaning Bug*
During development, a critical architectural defect was found in the text preprocessing layer. The ingestion worker successfully executed regex patterns to strip page numbers and repeating headers from PDFs, assigning it to `cleanedContent`. However, the code inadvertently passed the raw, uncleaned `fileContent` variable to the text splitter:

```javascript
// ❌ THE BUG: The cleaning result was ignored, introducing noise into the vectors
let cleanedContent = fileContent.replace(/.../gi, '');
const structuredChunks = splitter.splitText(fileContent); 

// ✅ THE ENTERPRISE FIX: Correctly routing the sanitized data stream
const structuredChunks = splitter.splitText(cleanedContent);
```
**Impact:** Resolving this variable typo immediately stopped messy layout strings and page headers from contaminating the vector cache, stabilizing the semantic matching accuracy and reducing noise across downstream cross-encoder tasks.
