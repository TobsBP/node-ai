# 🤖 node-ai

A REST API that uses AI to classify support tickets, store them in a vector database, and answer questions about them using RAG (Retrieval-Augmented Generation). It also integrates with Jira to automatically create issues from incoming tickets.

## ✨ Features

- 🎫 **Ticket classification** — AI analyzes incoming messages and assigns category, severity, summary, tags, and a detailed analysis
- 🗄️ **Vector storage** — tickets are embedded and stored in Qdrant for semantic search
- 💬 **RAG chat** — answer questions using context retrieved from similar past tickets
- 🔗 **Jira integration** — automatically creates a Jira issue for each new ticket
- 🔍 **Semantic search** — find similar tickets by meaning, not just keywords
- 📖 **Interactive API docs** — Scalar UI available at `/docs`

## 🛠️ Tech Stack

- **Runtime:** Node.js 20, TypeScript
- **Framework:** Fastify 5
- **AI:** Google Gemini (generation + embeddings via `gemini-embedding-001`)
- **Vector DB:** Qdrant
- **Database:** MongoDB (conversation history + ticket persistence)
- **Validation:** Zod
- **Linting:** Biome

## 🚀 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tickets` | Classify a message, save to vector DB, and create a Jira issue |
| `POST` | `/tickets/search` | Search similar tickets by semantic similarity |
| `POST` | `/chat` | Send a message and get an AI response grounded in past tickets |

### POST `/tickets`

```json
{
  "message": "Users can't log in after the latest deploy",
  "source": "slack"
}
```

Response `201`:
```json
{
  "ticket": {
    "id": "...",
    "message": "...",
    "category": "auth",
    "severity": "critical",
    "summary": "...",
    "analysis": "...",
    "tags": ["login", "auth"],
    "source": "slack",
    "created_at": "..."
  },
  "jira": {
    "id": "...",
    "key": "PROJ-42",
    "url": "https://yourorg.atlassian.net/browse/PROJ-42"
  }
}
```

Ticket categories: `bug`, `infra`, `auth`, `feature`, `other`  
Severity levels: `critical`, `high`, `medium`, `low`

### POST `/tickets/search`

```json
{ "message": "authentication failure" }
```

Query param: `?limit=5` (1–20, default 5)

### POST `/chat`

```json
{
  "message": "What are the most common auth issues we've seen?",
  "source": "web"
}
```

Response `200`:
```json
{ "reply": "Based on past tickets, the most common auth issues are..." }
```

## ⚙️ Environment Variables

Create a `.env` file at the project root:

```env
# 🤖 Google Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash

# 🍃 MongoDB
MONGO_URI=mongodb://localhost:27017/node-ai

# 🗄️ Qdrant
QDRANT_URL=http://localhost:6333

# 🔗 Jira
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=PROJ
```

## 💻 Running Locally

**Prerequisites:** Node.js 20+, a running Qdrant instance, a MongoDB instance.

```bash
npm install
npm run dev
```

The API will be available at `http://localhost:3333`.  
Interactive docs: `http://localhost:3333/docs`

## 🐳 Running with Docker

```bash
docker build -t node-ai .
docker run -p 3333:3333 --env-file .env node-ai
```

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | ♻️ Start dev server with hot reload |
| `npm run build` | 🔨 Compile TypeScript to `dist/` |
| `npm start` | ▶️ Run compiled output |
| `npm run lint` | 🧹 Lint and auto-fix with Biome |
