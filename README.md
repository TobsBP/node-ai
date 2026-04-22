# node-ai

A REST API that uses AI to classify support tickets, store them in a vector database, and answer questions using RAG (Retrieval-Augmented Generation). Integrates with Jira and Monday.com to automatically create and assign issues.

## Features

- **Ticket classification** — AI analyzes incoming tickets and assigns category, severity, area, summary, tags, and a detailed analysis
- **Smart assignment** — automatically assigns tickets to the right person based on area (backend → Tobias, frontend → Gustavo)
- **Jira + Monday integration** — creates issues/items in both platforms simultaneously
- **Vector storage** — tickets are embedded and stored in Qdrant for semantic search
- **RAG chat** — answer questions using context retrieved from similar past tickets
- **Firebase auth** — ticket creation requires a valid Firebase ID token
- **File upload** — accepts images and files via multipart/form-data

## Tech Stack

- **Runtime:** Node.js 20, TypeScript
- **Framework:** Fastify 5
- **AI:** Google Gemini (generation + embeddings via `gemini-embedding-001`)
- **Vector DB:** Qdrant
- **Database:** MongoDB
- **Auth:** Firebase Admin
- **Validation:** Zod
- **Linting:** Biome

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets` | List all tickets |
| `POST` | `/tickets` | Classify a ticket, save and create Jira/Monday issues |
| `POST` | `/tickets/search` | Search similar tickets by semantic similarity |
| `GET` | `/chats` | List all conversations |
| `POST` | `/chat` | Send a message and get an AI response grounded in past tickets |

### POST `/tickets`

Requires `Authorization: Bearer <firebase_token>` header.

Content-Type: `multipart/form-data`

| Field | Required | Description |
|-------|----------|-------------|
| `title` | yes | Ticket title (max 100 chars) |
| `system` | yes | System name |
| `studentEmail` | yes | Student email |
| `deviceModel` | no | Device model (max 60 chars) |
| `version` | no | App/system version (max 20 chars) |
| `description` | no | Issue description (max 2000 chars) |
| `file` | no | Image or file (JPG, PNG, WEBP, PDF, TXT — max 10 MB) |

Response `201`:
```json
{
  "ticket": {
    "id": "...",
    "title": "Login error",
    "system": "App v3 (Android)",
    "studentEmail": "student@example.com",
    "category": "auth",
    "severity": "high",
    "area": "backend",
    "status": "open",
    "createdBy": "<firebase_uid>",
    "summary": "...",
    "analysis": "...",
    "tags": ["login", "auth"],
    "created_at": "..."
  },
  "jira": {
    "id": "...",
    "key": "PROJ-42",
    "url": "https://yourorg.atlassian.net/browse/PROJ-42"
  },
  "monday": {
    "id": "...",
    "url": "https://yourorg.monday.com/boards/..."
  }
}
```

### POST `/tickets/search`

```json
{ "message": "authentication failure" }
```

Query param: `?limit=5` (1–20, default 5)

### POST `/chat`

```json
{
  "message": "What are the most common auth issues?",
  "source": "web"
}
```

Response `200`:
```json
{ "reply": "Based on past tickets, the most common auth issues are..." }
```

## Environment Variables

```env
# Google Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash

# MongoDB
MONGO_URI=mongodb://localhost:27017/node-ai

# Qdrant
QDRANT_URL=http://localhost:6333

# Jira
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=PROJ
JIRA_ASSIGNEE_BACKEND=<jira_account_id_backend>
JIRA_ASSIGNEE_FRONTEND=<jira_account_id_frontend>

# Monday
MONDAY_API_TOKEN=your_monday_api_token
MONDAY_BOARD_ID=your_board_id
MONDAY_ASSIGNEE_BACKEND=<monday_user_id_backend>
MONDAY_ASSIGNEE_FRONTEND=<monday_user_id_frontend>

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
```

## Running Locally

```bash
npm install
npm run dev
```

API available at `http://localhost:3333` — docs at `http://localhost:3333/docs`

## Docker

```bash
docker build -t node-ai .
docker run -p 3333:3333 --env-file .env node-ai
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm run lint` | Lint and auto-fix with Biome |
