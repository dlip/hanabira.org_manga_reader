# 🚀 Mokuro Reader Enhanced - Complete Setup Guide

## 📋 **Architecture Overview**

```
mokuro-reader-enhanced/
├── frontend/           # Next.js 15 application (Port 3000)
│   ├── src/           # React components, pages, API routes
│   ├── public/        # Static assets, manga library
│   └── Dockerfile     # Frontend container
├── backend/           # Flask Python API (Port 5000)
│   ├── app.py        # Main Flask application
│   ├── data/         # SQLite database, uploads
│   └── Dockerfile    # Backend container
├── docker-compose.yml               # Production deployment (named volumes)
├── docker-compose.dev.yml           # Development deployment (named volumes)
├── docker-compose.host-mounts.yml   # Production with host bind mounts
├── docker-compose.host-mounts.dev.yml # Development with host bind mounts
├── host-data/                       # Host-accessible data (bind mounts)
│   ├── backend-data/               # SQLite DB, uploaded files
│   ├── logs/                       # Application logs
│   └── manga-library/             # Mokuro manga files (USER ACCESS)
├── DOCKER_README.md                # Docker-specific docs
└── HOST_MOUNTS_GUIDE.md           # Host bind mounts setup guide
```

## 🔧 **Environment Configuration Status**

✅ **Fixed Issues:**
- Unified all API URL references to use `NEXT_PUBLIC_API_URL`
- Consistent Docker container networking
- Proper health check endpoints
- Volume persistence configuration

## 🚀 **How to Run**

### **Option 1A: Docker Production (Named Volumes)**

```bash
# 1. Setup environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys:
# OPENAI_API_KEY=your_key_here
# DEEPL_API_KEY=your_key_here

# 2. Start containers
docker compose up -d

# 3. Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/health
```

### **Option 1B: Docker Production (Host Bind Mounts) - RECOMMENDED for file access**

```bash
# 1. Setup environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# 2. Setup host directories for easy file access
./setup-host-dirs.sh

# 3. Add your manga files
cp -r /your/mokuro/manga/* ./host-data/manga-library/

# 4. Start containers with host mounts
docker compose -f docker-compose.host-mounts.yml up -d

# 5. Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/health
# Your files are accessible in: ./host-data/manga-library/
```
📖 **See [HOST_MOUNTS_GUIDE.md](./HOST_MOUNTS_GUIDE.md) for detailed file management instructions.**

### **Option 2: Docker Development**

```bash
# Development mode with hot reloading
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose logs -f frontend
docker compose logs -f backend
```

### **Option 3: Local Development**

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with API keys
python app.py

# Terminal 2: Frontend  
cd frontend
npm install
npm run dev
```

## 🌐 **Network Configuration**

| Mode | Frontend | Backend | API Client URL |
|------|----------|---------|----------------|
| **Docker** | `frontend:3000` | `backend:5000` | `http://backend:5000` |
| **Local Dev** | `localhost:3000` | `localhost:5000` | `http://localhost:5000` |

### **Environment Variables:**

```bash
# Development (.env.local or local environment)
NEXT_PUBLIC_API_URL=http://localhost:5000

# Docker Production (set in docker-compose.yml)
NEXT_PUBLIC_API_URL=http://backend:5000
```

## 🗄️ **Data Persistence**

### **Docker Volumes:**
- `backend_data` → `/app/data` (SQLite DB, user data)
- `backend_logs` → `/app/logs` (Application logs)
- `manga_library` → `/app/public/library` (Shared manga files)

### **Volume Management:**
```bash
# List volumes
docker volume ls

# Backup database
docker compose exec backend cp /app/data/flashcards.db /tmp/backup.db
docker cp mokuro-backend:/tmp/backup.db ./backup-$(date +%Y%m%d).db

# Clean reset (removes ALL data)
docker compose down -v
```

## 🔍 **Health Checks**

```bash
# Check service health
curl http://localhost:3000/api/health  # Frontend
curl http://localhost:5000/health      # Backend

# Container status
docker compose ps
```

## 📁 **File Upload Configuration**

- **Max file size:** 500MB
- **Supported formats:** ZIP, HTML, .mokuro, images
- **Upload timeout:** 5 minutes
- **Storage location:** Shared `manga_library` volume

## 🛠️ **Development Commands**

```bash
# Start development
docker compose -f docker-compose.dev.yml up -d

# Rebuild after code changes  
docker compose up -d --build

# View logs
docker compose logs -f [frontend|backend]

# Shell access
docker compose exec frontend sh
docker compose exec backend bash

# Stop services
docker compose down
```

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **Frontend can't reach backend**
   ```bash
   # Check if backend is running
   curl http://localhost:5000/health
   
   # Check container networking
   docker compose exec frontend wget -qO- http://backend:5000/health
   ```

2. **Build failures**
   ```bash
   # Clean Docker cache
   docker system prune -f
   
   # Rebuild from scratch
   docker compose build --no-cache
   ```

3. **Large file uploads fail**
   ```bash
   # Check available disk space
   df -h
   
   # Check container resource limits
   docker stats
   ```

### **Environment Validation:**

```bash
# Check environment variables in containers
docker compose exec frontend env | grep API_URL
docker compose exec backend env | grep FLASK
```

## 📊 **Feature Verification Checklist**

After startup, verify these features work:

- [ ] **Frontend loads** at http://localhost:3000
- [ ] **Backend API** responds at http://localhost:5000/health  
- [ ] **Translation** (requires API keys in backend/.env)
- [ ] **File upload** (drag & drop or file browser)
- [ ] **Flashcards** (create/view/export)
- [ ] **SRS system** (spaced repetition)
- [ ] **Data persistence** (survives container restart)

## 💡 **Performance Tips**

- Use production mode for better performance: `docker compose up -d`
- Development mode has hot reloading but uses more resources
- Monitor resource usage: `docker stats`
- Clean up periodically: `docker system prune`

## 🔒 **Security Notes**

- API keys stored in backend container environment
- Non-root users in containers  
- No external network dependencies required
- All communication via internal Docker network
- SQLite database protected in persistent volume

---

## 🎯 **Quick Start Summary**

```bash
# 1. Get API keys (OpenAI, DeepL) 
# 2. Configure backend
cp backend/.env.example backend/.env
# Edit backend/.env with your keys

# 3. Start application
docker compose up -d

# 4. Open browser
# http://localhost:3000
```

**That's it!** The application should be fully functional with persistent data storage and all features working.