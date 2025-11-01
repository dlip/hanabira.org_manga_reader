# Manga Reader - Docker Setup

A containerized manga reader application with OCR translation features.

## Quick Start

### Prerequisites
- Docker
- Docker Compose

### 1. Environment Configuration

Copy the example environment file and configure your API keys:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your API keys:
```env
OPENAI_API_KEY=your_actual_openai_key
OPENAI_ORG_ID=your_actual_org_id
DEEPL_API_KEY=your_actual_deepl_key
```

### 2. Production Deployment

Build and start the application:

```bash
docker-compose up -d
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### 3. Development Mode

For development with hot reloading:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Docker Network                   │
│                (mokuro-network)                │
│                                                │
│  ┌─────────────────┐    ┌─────────────────┐   │
│  │   Frontend      │    │   Backend       │   │
│  │   (Next.js)     │◄──►│   (Flask)       │   │
│  │   Port: 3000    │    │   Port: 5000    │   │
│  └─────────────────┘    └─────────────────┘   │
└─────────────────────────────────────────────────┘
            ▲                        ▲
    ┌───────▼────────┐      ┌────────▼──────┐
    │   Host:3000    │      │  Host:5000    │
    │   (Frontend)   │      │  (API)        │
    └────────────────┘      └───────────────┘
```

## Persistent Data

The following data is persisted across container restarts:

- **SQLite Database**: User data, flashcards, progress
- **Manga Library**: Uploaded manga files and images  
- **Logs**: Application logs for debugging

## Management Commands

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Stop services
```bash
docker-compose down
```

### Rebuild after code changes
```bash
docker-compose up -d --build
```

### Clean reset (removes all data)
```bash
docker-compose down -v
docker system prune -f
```

## Configuration

### Environment Variables

**Backend** (`backend/.env`):
- `OPENAI_API_KEY` - Required for AI translation features
- `OPENAI_ORG_ID` - Optional OpenAI organization ID
- `DEEPL_API_KEY` - Optional for DeepL translation

**Container Networking**:
- Frontend connects to backend via internal Docker network
- API proxy routes `/api/translate/*`, `/api/flashcards/*`, `/api/media/*`

### Volumes

- `backend_data` - SQLite database and user data
- `backend_logs` - Application logs  
- `manga_library` - Shared manga files between containers

## Troubleshooting

### Services won't start
1. Check API keys in `backend/.env`
2. Ensure ports 3000 and 5000 are available
3. Check logs: `docker-compose logs`

### Frontend can't connect to backend
1. Verify backend health: `curl http://localhost:5000/health`
2. Check internal networking: `docker-compose logs frontend`

### Large file uploads fail
- The system supports up to 500MB uploads
- Check available disk space for Docker volumes

## Development

For local development without Docker:

1. **Backend**: `cd backend && python app.py`
2. **Frontend**: `cd frontend && npm run dev`

The frontend will proxy API calls to `localhost:5000` automatically.