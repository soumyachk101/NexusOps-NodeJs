<div align="center">

<br />

<img src="https://media.giphy.com/media/qgQUggACfP3NqCxMx6/giphy.gif" width="80" height="80" />

# **NexusOps 2.0**

### The Intelligent Command Center for Modern AIOps

<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdG1hNnV3dHF0ZHRhazQ3NGNqbjB4cnY4bG14ZmJqcG16cjJ4eGZzdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT9IgzoKnwFNmISR8I/giphy.gif" width="100%" height="3" />

<br />

[![Version](https://img.shields.io/badge/version-2.0.5-8B5CF6?style=for-the-badge&logoColor=white)](https://github.com/soumyachk101/NexusOps-2.0/releases)
[![License](https://img.shields.io/badge/license-MIT-10B981?style=for-the-badge&logoColor=white)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://prisma.io)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://js.langchain.com)
[![Groq](https://img.shields.io/badge/Groq-AI-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com)
[![Ollama](https://img.shields.io/badge/Ollama-Self--Hosted_LLM-000000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.ai)
[![Slack](https://img.shields.io/badge/Slack-Integration-4A154B?style=for-the-badge&logo=slack&logoColor=white)](https://slack.com)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Tracing-425CC7?style=for-the-badge&logo=opentelemetry&logoColor=white)](https://opentelemetry.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)

<br />

> *Most AI observability tools only see the current stack trace.*
> *NexusOps sees the last 6 months of your team's institutional memory.*

<br />

<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdG1hNnV3dHF0ZHRhazQ3NGNqbjB4cnY4bG14ZmJqcG16cjJ4eGZzdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT9IgzoKnwFNmISR8I/giphy.gif" width="100%" height="3" />

</div>

---

## **Table of Contents**

- [Why NexusOps?](#-why-nexusops)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture)
- [Core Features](#-core-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Security Model](#-security-model)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## **Why NexusOps?**

<br />

<table>
<tr>
<td width="50%">

### The Problem

Every production incident follows the same painful cycle:

1. Alert fires at 2 AM
2. SRE scrambles through Slack threads
3. Someone vaguely remembers a similar bug from 3 months ago
4. Nobody can find the old fix
5. Hours wasted re-diagnosing known issues

</td>
<td width="50%">

### The Solution

NexusOps **remembers** so your team doesn't have to:

1. Webhook arrives — incident captured instantly
2. Memory engine finds 3 similar past incidents
3. AI generates root cause analysis with context
4. Draft PR created with a proposed fix
5. Human reviews and merges. Done.

</td>
</tr>
</table>

<br />

<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdG1hNnV3dHF0ZHRhazQ3NGNqbjB4cnY4bG14ZmJqcG16cjJ4eGZzdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT9IgzoKnwFNmISR8I/giphy.gif" width="100%" height="2" />

---

## **How It Works**

<br />

```mermaid
graph LR
    A["🔴 Sentry\nWebhook"] -->|"POST /webhook/sentry"| B["⚡ Express\nGateway"]
    C["✈️ Telegram\nBot"] -->|"Messages"| B
    D["📡 Custom\nTelemetry"] -->|"POST /webhook/error"| B
    E["💼 Slack\nEvents"] -->|"POST /api/v1/slack/events"| B
    F["🔍 Ollama\nSelf-Hosted LLM"] -.->|"Fallback"| G["🤖 Groq\nLLM"]
    
    B --> H["🛡️ PII\nSanitizer"]
    H --> I["🧠 Memory\nEngine"]
    I <-->|"pgvector\n1536-dim"| J[("🐘 PostgreSQL\npgvector")]
    
    I --> K["⚙️ BullMQ\nQueue"]
    K <--> L[("🔴 Redis")]
    K --> G
    
    G --> M["📝 Root Cause\nAnalysis"]
    M --> N["🔧 Fix\nGenerator"]
    N --> O["📬 GitHub\nDraft PR"]
    N --> P["📊 Dashboard\nUpdate"]
    N --> Q["💬 Notifications\n(Telegram/Slack)"]
    N --> R["📊 Confidence\nScoring"]
    R --> S["📋 Post-Mortem\nPDF Export"]
    
    style A fill:#EF4444,stroke:#B91C1C,color:#fff
    style C fill:#3B82F6,stroke:#1D4ED8,color:#fff
    style D fill:#F59E0B,stroke:#D97706,color:#fff
    style E fill:#4A154B,stroke:#350A2E,color:#fff
    style F fill:#000000,stroke:#333333,color:#fff
    style G fill:#10B981,stroke:#059669,color:#fff
    style H fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style I fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style J fill:#3B82F6,stroke:#1D4ED8,color:#fff
    style K fill:#F59E0B,stroke:#D97706,color:#fff
    style L fill:#EF4444,stroke:#B91C1C,color:#fff
    style M fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style N fill:#3B82F6,stroke:#1D4ED8,color:#fff
    style O fill:#10B981,stroke:#059669,color:#fff
    style P fill:#F59E0B,stroke:#D97706,color:#fff
    style Q fill:#EF4444,stroke:#B91C1C,color:#fff
    style R fill:#6366F1,stroke:#4F46E5,color:#fff
    style S fill:#4169E1,stroke:#2B4CB8,color:#fff
```

<br />

### Incident Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Received : Webhook Arrives
    Received --> Sanitizing : PII Stripped
    Sanitizing --> Analyzing : Groq LLM Analysis
    Analyzing --> Querying_Memory : pgvector Search
    Querying_Memory --> Generating_Fix : Context Enriched
    Generating_Fix --> Fix_Blocked : Safety Check Failed
    Generating_Fix --> Resolved : Fix Generated
    Resolved --> PR_Created : Human Creates PR
    PR_Created --> Merged : Human Reviews & Merges
    Fix_Blocked --> [*]
    Merged --> [*]
    
    Received --> Failed : Pipeline Error
    Failed --> Received : Retry
```

<br />

---

## **Architecture**

<br />

```mermaid
graph TD
    subgraph INGESTION ["📥 INGESTION LAYER"]
        A1["🔴 Sentry Webhooks"]
        A2["✈️ Telegram Bot — Telegraf"]
        A3["📡 Custom Telemetry"]
        A4["📝 Manual Input"]
        A5["💼 Slack Events API"]
        A6["📄 Documents (PDF/DOCX/Audio)"]
    end

    subgraph PROCESSING ["⚙️ PROCESSING LAYER"]
        B1["⚡ Express.js Gateway"]
        B2["🛡️ PII & Secret Sanitizer"]
        B3["🧠 LangChain Memory Engine"]
        B4[("🐘 PostgreSQL + pgvector")]
        B5["📋 BullMQ Pipeline"]
        B6[("🔴 Redis Queue")]
        B7["📊 OpenTelemetry Tracing"]
        B8["🔄 Memory Decay & Re-ranking"]
    end

    subgraph AI ["🤖 AI LAYER"]
        C1["🤖 Groq LLM — Llama 3.3 70B"]
        C2["🦙 Ollama — Self-hosted LLM"]
        C3["📊 Analysis Chain"]
        C4["🔧 Fix Generation Chain"]
        C5["🔍 Similarity Search"]
        C6["📈 Confidence Scoring Engine"]
    end

    subgraph OUTPUT ["📤 OUTPUT LAYER"]
        D1["📬 GitHub Draft PR — Octokit"]
        D2["🖥️ Real-time Dashboard"]
        D3["💬 Telegram Notifications"]
        D4["💼 Slack Notifications"]
        D5["📋 Activity Logs"]
        D6["📄 Post-Mortem PDF Export"]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    A5 --> B1
    A6 --> B1

    B1 --> B7
    B7 --> B2
    B2 --> B3
    B3 <--> B4
    B3 --> B8
    B3 --> B5
    B5 <--> B6

    B5 --> C1
    B5 --> C2
    C1 --> C3
    C2 --> C3
    C3 --> C4
    C4 --> C6
    C3 --> C5

    C6 --> D1
    C4 --> D2
    C4 --> D3
    C4 --> D4
    C4 --> D5
    C6 --> D6

    style INGESTION fill:#1E1B4B,stroke:#8B5CF6,color:#E0E7FF
    style PROCESSING fill:#1E1B4B,stroke:#6D28D9,color:#E0E7FF
    style AI fill:#1E1B4B,stroke:#4C1D95,color:#E0E7FF
    style OUTPUT fill:#1E1B4B,stroke:#5B21B6,color:#E0E7FF
```

<br />

---

## **Core Features**

<br />

<table>
<tr>
<td width="50%" valign="top">

### 🧠 Memory Engine

The brain of NexusOps. Built on **pgvector** with cosine similarity search.

**What it remembers:**
- Past incident analyses and fixes
- Telegram team discussions
- Ingested documents (PDF, DOCX, audio)
- Runbooks and internal docs

**Why it matters:**
> An SRE triaging a payment service error at 2 AM needs to know that the same error appeared 3 months ago because of a race condition — and the fix was a 2-line change. NexusOps surfaces this automatically.

</td>
<td width="50%" valign="top">

### 🤖 AutoFix Engine

Powered by **Groq Llama 3.3 70B** via LangChain chains.

**Pipeline stages:**
1. `received` — Webhook captured
2. `sanitizing` — PII stripped
3. `analyzing` — Root cause identified
4. `querying_memory` — Past context found
5. `generating_fix` — Code fix generated
6. `resolved` — Ready for human review

**Safety guarantees:**
- Dangerous pattern detection (`rm -rf`, `eval`, etc.)
- Confidence scoring (0.0 - 1.0)
- Draft PRs only — never auto-merges

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📚 Document Ingestion

Multi-format support with intelligent chunking:

| Format | Handler |
|--------|---------|
| PDF | `pdf-parse` |
| DOCX | `mammoth` |
| Audio | OpenAI Whisper |
| Slack Messages | Slack Events API |
| Text/Markdown | Direct ingestion |

**Features:**
- Recursive text splitting (1000 chars, 150 overlap)
- Automatic task detection via LLM
- Memory decay with time-based re-ranking
- Access-frequency boosting for popular chunks
- Cloudflare R2 storage for files

</td>
<td width="50%" valign="top">

### 🔗 Integrations

| Service | Purpose |
|---------|---------|
| **Sentry** | Error webhook ingestion |
| **GitHub** | Code fetch, branch create, Draft PRs |
| **Telegram** | Message ingestion + notifications |
| **Slack** | Event ingestion + notifications |
| **Jira** | Task sync with bidirectional updates |
| **Groq** | LLM inference (analysis + fix gen) |
| **Ollama** | Self-hosted LLM (Llama 3.3 fallback) |
| **OpenAI** | Embeddings (text-embedding-3-small) |
| **OpenTelemetry** | Distributed tracing (OTLP export) |

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📊 Dashboard API

Real-time operational intelligence:

- **Stats** — Total incidents, resolution rate, avg confidence
- **Timeline** — Recent activity across all modules
- **Time Series** — Incident trends for charts
- **Workspace scoped** — Multi-tenant by design

</td>
<td width="50%" valign="top">

### 🔄 Revert Engine

Automated rollback capability:

- Error rate monitoring via snapshots
- Configurable threshold triggers
- Vercel/Railway deploy integration
- Full revert event history
- Telegram alerts on revert

</td>
</tr>
</table>

<br />

---

## **Tech Stack**

<br />

<div align="center">

### Backend

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-4.x-000000?style=flat-square&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-Queue-5B21B6?style=flat-square)
![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?style=flat-square&logo=socket.io&logoColor=white)

### AI / ML

![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C3C?style=flat-square&logo=langchain&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036?style=flat-square&logo=groq&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-Embeddings-412991?style=flat-square&logo=openai&logoColor=white)
![pgvector](https://img.shields.io/badge/pgvector-Vector_DB-4169E1?style=flat-square&logo=postgresql&logoColor=white)

### AI / ML

![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C3C?style=flat-square&logo=langchain&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036?style=flat-square&logo=groq&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-Self--Hosted_LLM-000000?style=flat-square&logo=ollama&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-Embeddings-412991?style=flat-square&logo=openai&logoColor=white)
![pgvector](https://img.shields.io/badge/pgvector-Vector_DB-4169E1?style=flat-square&logo=postgresql&logoColor=white)

### Integrations

![GitHub](https://img.shields.io/badge/GitHub-Octokit-181717?style=flat-square&logo=github&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-Telegraf-26A5E4?style=flat-square&logo=telegram&logoColor=white)
![Slack](https://img.shields.io/badge/Slack-Events_API-4A154B?style=flat-square&logo=slack&logoColor=white)
![Jira](https://img.shields.io/badge/Jira-REST_API-0052CC?style=flat-square&logo=jira&logoColor=white)
![Sentry](https://img.shields.io/badge/Sentry-Webhooks-362D59?style=flat-square&logo=sentry&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth-DD2C00?style=flat-square&logo=firebase&logoColor=white)
![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-OTLP-425CC7?style=flat-square&logo=opentelemetry&logoColor=white)

</div>

<br />

---

## **Getting Started**

<br />

### Prerequisites

```
Node.js >= 20.x     PostgreSQL >= 15     Redis >= 7
Docker >= 24.x      Git                  npm or yarn
```

<br />

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/soumyachk101/NexusOps-2.0.git
cd NexusOps-2.0

# 2. Install dependencies
cd backend && npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials (see Configuration section)

# 4. Setup database
npx prisma generate
npx prisma migrate dev

# 5. Start the server
npm run dev
```

<br />

### Docker Setup

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend npx prisma migrate deploy
```

<br />

---

## **API Reference**

<br />

<details>
<summary><b>🔐 Auth Endpoints</b></summary>

```
POST   /api/v1/auth/register          Register new user
POST   /api/v1/auth/login             Email/password login
POST   /api/v1/auth/firebase          Sync Firebase user
GET    /api/v1/auth/github/callback   GitHub OAuth callback
GET    /api/v1/auth/google/callback   Google OAuth callback
```

</details>

<details>
<summary><b>📋 Workspace Endpoints</b></summary>

```
GET    /api/v1/workspace              List user workspaces
GET    /api/v1/workspace/:id          Get workspace details
POST   /api/v1/workspace              Create workspace
```

</details>

<details>
<summary><b>🤖 AutoFix Endpoints</b></summary>

```
GET    /api/v1/autofix/repos/                 List connected repos
POST   /api/v1/autofix/repos/connect          Connect GitHub repo
DELETE /api/v1/autofix/repos/:id               Disconnect repo

GET    /api/v1/autofix/incidents/              List incidents
POST   /api/v1/autofix/incidents/manual        Create manual incident
GET    /api/v1/autofix/incidents/:id           Get incident details
PATCH  /api/v1/autofix/incidents/:id/status    Update status
POST   /api/v1/autofix/incidents/:id/retry     Retry pipeline

GET    /api/v1/autofix/fixes/incident/:id      Get fixes for incident
POST   /api/v1/autofix/fixes/:id/create-pr     Create GitHub PR
POST   /api/v1/autofix/fixes/:id/review        Review fix

GET    /api/v1/autofix/reverts/                Revert history
POST   /api/v1/autofix/reverts/trigger         Trigger revert
```

</details>

<details>
<summary><b>🧠 Memory Endpoints</b></summary>

```
POST   /api/v1/memory/telegram/webhook        Telegram bot webhook
GET    /api/v1/memory/ingest/                  List sources
POST   /api/v1/memory/ingest/document          Ingest document text
POST   /api/v1/memory/ingest/audio             Ingest audio file
POST   /api/v1/memory/ingest                   Ingest uploaded file
GET    /api/v1/memory/query/                   Query (GET)
POST   /api/v1/memory/query                    Query (POST)
GET    /api/v1/memory/tasks/                   List detected tasks
PATCH  /api/v1/memory/tasks/:id                Update task
POST   /api/v1/memory/tasks/:id/jira           Sync to Jira
GET    /api/v1/memory/problems                 List problems
POST   /api/v1/memory/problems/detect          Detect problems
```

</details>

<details>
<summary><b>📊 Dashboard Endpoints</b></summary>

```
GET    /api/v1/dashboard/stats                 Workspace statistics
GET    /api/v1/dashboard/timeline              Activity timeline
GET    /api/v1/dashboard/incidents/series      Incident time series
```

</details>

<details>
<summary><b>🔗 Webhook Endpoints</b></summary>

```
POST   /webhook/sentry/:workspaceId    Sentry error events
POST   /webhook/error/:workspaceId     Custom telemetry
POST   /webhook/github                 GitHub webhooks
```

</details>

<details>
<summary><b>💼 Slack Endpoints</b></summary>

```
POST   /api/v1/slack/events            Slack Events API (URL verification + ingestion)
POST   /api/v1/slack/notify            Send Slack notification (auth required)
```

</details>

<details>
<summary><b>🔔 Notification Endpoints</b></summary>

```
GET    /api/v1/notifications/           List notifications (paginated)
GET    /api/v1/notifications/stats      Notification statistics
POST   /api/v1/notifications/broadcast  Broadcast multi-channel notification
```

</details>

<details>
<summary><b>🦙 Ollama Endpoints</b></summary>

```
GET    /api/v1/ollama/health            Check Ollama availability + list models
POST   /api/v1/ollama/pull              Pull a model
POST   /api/v1/ollama/chat              Chat completion via Ollama
```

</details>

<details>
<summary><b>📋 Post-Mortem Endpoints</b></summary>

```
POST   /api/v1/postmortems/generate     Generate post-mortem from incident
GET    /api/v1/postmortems/             List post-mortems
GET    /api/v1/postmortems/:id          Get post-mortem by ID
POST   /api/v1/postmortems/:id/pdf      Generate PDF export
```

</details>

<details>
<summary><b>❤️ Health Endpoints</b></summary>

```
GET    /                       API info
GET    /health                 Full health check (DB status)
GET    /api/v1/health          Simple health check
```

</details>

<br />

---

## **Project Structure**

```
nexusops-2.0/
├── backend/
│   ├── src/
│   │   ├── controllers/          # Request handlers
│   │   │   ├── auth.controller.js
│   │   │   ├── autofix.controller.js
│   │   │   ├── dashboard.controller.js
│   │   │   ├── memory.controller.js
│   │   │   ├── webhook.controller.js
│   │   │   ├── workspace.controller.js
│   │   │   ├── slack.controller.js
│   │   │   ├── notification.controller.js
│   │   │   ├── ollama.controller.js
│   │   │   └── postmortem.controller.js
│   │   │
│   │   ├── services/             # Business logic
│   │   │   ├── autofix.service.js      # Incident pipeline + fix generation
│   │   │   ├── memory.service.js       # Document ingestion + RAG queries
│   │   │   ├── vector.service.js       # pgvector operations
│   │   │   ├── github.service.js       # Octokit integration
│   │   │   ├── telegram.service.js     # Telegraf bot
│   │   │   ├── slack.service.js        # Slack Events API ingestion
│   │   │   ├── jira.service.js         # Atlassian REST API
│   │   │   ├── dashboard.service.js    # Stats & analytics
│   │   │   ├── storage.service.js      # Cloudflare R2
│   │   │   ├── revert.service.js       # Deploy rollback
│   │   │   ├── problem.service.js      # Problem detection
│   │   │   ├── auth.service.js         # JWT + OAuth
│   │   │   ├── workspace.service.js    # Multi-tenant
│   │   │   ├── notification.service.js # Multi-channel notifications
│   │   │   ├── ollama.service.js       # Self-hosted LLM (Ollama)
│   │   │   ├── otel.service.js         # OpenTelemetry tracing
│   │   │   ├── confidence.service.js   # Confidence scoring engine
│   │   │   ├── memory-decay.service.js # Memory decay + re-ranking
│   │   │   └── postmortem.service.js   # PDF post-mortem export
│   │   │
│   │   ├── routes/               # Express routers
│   │   │   ├── auth.js
│   │   │   ├── autofix.js
│   │   │   ├── dashboard.js
│   │   │   ├── memory.js
│   │   │   ├── webhooks.js
│   │   │   ├── workspace.js
│   │   │   ├── slack.js
│   │   │   ├── notifications.js
│   │   │   ├── ollama.js
│   │   │   └── postmortems.js
│   │   │
│   │   ├── middleware/           # Express middleware
│   │   │   ├── auth.js                 # JWT verification + RBAC
│   │   │   └── error.js               # Error handling
│   │   │
│   │   ├── lib/                  # Core utilities
│   │   │   ├── config.js               # Zod-validated env config
│   │   │   ├── prisma.js               # Prisma client singleton
│   │   │   ├── http.js                 # HTTP helpers
│   │   │   └── tokens.js               # JWT utilities
│   │   │
│   │   ├── workers/              # BullMQ workers
│   │   │   └── queue.js
│   │   │
│   │   ├── utils/                # Shared utilities
│   │   │   ├── json.js                 # JSON extraction
│   │   │   └── slug.js                 # Slug generation
│   │   │
│   │   ├── config/               # External service configs
│   │   │   └── firebase.js
│   │   │
│   │   ├── bot.js                # Telegram bot entry
│   │   └── index.js              # Express app entry
│   │
│   ├── prisma/
│   │   └── schema.prisma         # Database schema (17 models)
│   │
│   ├── package.json
│   └── .env.example
│
└── README.md
```

<br />

---

## **Database Schema**

<br />

```mermaid
erDiagram
    users ||--o{ workspaces : "owns"
    users ||--o{ workspace_members : "joins"
    workspaces ||--o{ sources : "contains"
    workspaces ||--o{ document_chunks : "stores"
    workspaces ||--o{ incidents : "tracks"
    workspaces ||--o{ repositories : "connects"
    workspaces ||--o{ tasks : "detects"
    workspaces ||--o{ problems : "identifies"
    workspaces ||--o{ notifications : "sends"
    workspaces ||--o{ post_mortems : "generates"
    sources ||--o{ document_chunks : "produces"
    incidents ||--o{ fixes : "generates"
    incidents ||--o{ document_chunks : "references"
    incidents ||--o{ post_mortems : "documents"
    repositories ||--o{ incidents : "linked_to"
    document_chunks ||--o{ tasks : "extracts"

    users {
        uuid id PK
        varchar email UK
        varchar name
        varchar provider
        varchar github_id
        varchar google_id
    }

    workspaces {
        uuid id PK
        varchar name
        varchar slug UK
        uuid owner_id FK
        varchar telegram_chat_id
        varchar slack_channel_id
        varchar jira_project_key
        varchar ollama_base_url
        varchar otel_endpoint
    }

    incidents {
        uuid id PK
        uuid workspace_id FK
        uuid repository_id FK
        text raw_error
        text sanitized_error
        varchar error_type
        varchar severity
        varchar status
        float analysis_confidence
        float confidence_score
        varchar trace_id
        text root_cause
        varchar pr_url
    }

    fixes {
        uuid id PK
        uuid incident_id FK
        varchar title
        text explanation
        text diff
        float confidence
        varchar safety_score
        varchar status
        varchar pr_url
    }

    document_chunks {
        uuid id PK
        uuid workspace_id FK
        uuid source_id FK
        text text
        vector embedding
        float relevance_score
        int access_count
        float decay_factor
        jsonb metadata
    }

    notifications {
        uuid id PK
        uuid workspace_id FK
        varchar channel
        varchar event_type
        varchar title
        text body
        varchar status
    }

    post_mortems {
        uuid id PK
        uuid workspace_id FK
        uuid incident_id FK
        varchar title
        text summary
        text root_cause
        jsonb timeline
        text impact
        text remediation
        varchar pdf_url
    }
```

<br />

---

## **Configuration**

<br />

<details>
<summary><b>Environment Variables</b></summary>

```env
# ── Application ──────────────────────────────────────────
NODE_ENV=development
PORT=8000
JWT_SECRET=your-secret-key-minimum-32-characters
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
CORS_ORIGIN=*

# ── Database ─────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/nexusops

# ── Redis ────────────────────────────────────────────────
REDIS_URL=redis://127.0.0.1:6379

# ── AI (Required) ────────────────────────────────────────
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile

# ── AI (Optional — for embeddings) ───────────────────────
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1

# ── GitHub ───────────────────────────────────────────────
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# ── Telegram ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# ── Jira ─────────────────────────────────────────────────
JIRA_BASE_URL=https://team.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token

# ── Firebase (Optional) ──────────────────────────────────
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_WEB_API_KEY=your-web-api-key

# ── Sentry ───────────────────────────────────────────────
SENTRY_WEBHOOK_SECRET=your-sentry-webhook-secret

# ── Slack ────────────────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret

# ── Ollama (Optional — self-hosted LLM) ─────────────────
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.3:70b
OLLAMA_FALLBACK_ENABLED=false

# ── OpenTelemetry (Optional — tracing) ──────────────────
OTLP_ENDPOINT=https://your-otel-collector:4318
OTLP_SERVICE_NAME=nexusops-backend

# ── Workers ──────────────────────────────────────────────
START_WORKERS=true
START_BOT=true
```

</details>

<br />

---

## **Security Model**

<br />

```mermaid
flowchart LR
    A["🌐 External\nInput"] --> B["✅ HMAC\nVerification"]
    B --> C["🚦 Rate\nLimiter"]
    C --> D["🛡️ PII\nSanitizer"]
    D --> E["🤖 Groq LLM\n(Sanitized Only)"]
    E --> F["📋 Audit\nLogger"]
    F --> G["📬 GitHub\nDraft PR"]
    
    style A fill:#EF4444,stroke:#B91C1C,color:#fff
    style B fill:#10B981,stroke:#059669,color:#fff
    style C fill:#F59E0B,stroke:#D97706,color:#fff
    style D fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style E fill:#3B82F6,stroke:#1D4ED8,color:#fff
    style F fill:#6366F1,stroke:#4F46E5,color:#fff
    style G fill:#10B981,stroke:#059669,color:#fff
```

**What gets sanitized:**
- API keys (sk-, pk-, ghp-, AKIA, etc.)
- JWT tokens
- Database connection strings
- Email addresses
- IPv4 addresses
- Password assignments

**What gets blocked:**
- `rm -rf` commands
- `eval()` / `new Function()`
- `child_process` / `execSync`
- `DROP TABLE` / `DELETE FROM`
- `process.env` assignments

<br />

---

## **Roadmap**

<br />

- [x] Sentry webhook ingestion
- [x] LangChain RAG memory enrichment
- [x] Groq LLM inference (Llama 3.3 70B)
- [x] GitHub Draft PR generation
- [x] Telegram notifications (outbound)
- [x] Confidence scoring (multi-signal engine)
- [x] BullMQ async pipeline (5 queues: autofix, maintenance, memory, notifications, postmortems)
- [x] Jira task sync
- [x] Document ingestion (PDF, DOCX, audio, Slack)
- [x] Problem detection
- [x] Revert engine (Vercel + Railway)
- [x] Slack ingestion adapter (Events API)
- [x] OpenTelemetry trace integration (OTLP export)
- [x] Multi-repository support
- [x] RBAC for team-level access control (admin/member/viewer)
- [x] Memory decay and re-ranking policies (exponential decay + access boost)
- [x] Exportable incident post-mortems (PDF via PDFKit)
- [x] Self-hosted LLM option via Ollama (with Groq fallback)

<br />

---

## **Contributing**

<br />

```bash
# 1. Fork and clone
git clone https://github.com/your-username/NexusOps-2.0.git

# 2. Create feature branch
git checkout -b feat/your-feature

# 3. Make changes and test
cd backend && npm test

# 4. Commit with conventional commits
git commit -m "feat: add slack ingestion adapter"

# 5. Push and create PR
git push origin feat/your-feature
```

<br />

---

## **License**

Distributed under the [MIT License](./LICENSE).

<br />

---

<div align="center">

### Built with dedication by

**[Soumya Chakraborty](https://chksoumya.in)**

[![GitHub](https://img.shields.io/badge/GitHub-soumyachk101-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/soumyachk101)
[![Portfolio](https://img.shields.io/badge/Portfolio-chksoumya.in-8B5CF6?style=for-the-badge&logoColor=white)](https://chksoumya.in)

<br />

<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdG1hNnV3dHF0ZHRhazQ3NGNqbjB4cnY4bG14ZmJqcG16cjJ4eGZzdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT9IgzoKnwFNmISR8I/giphy.gif" width="100%" height="3" />

<br />

*If this project was useful to you, consider leaving a ⭐*

</div>
