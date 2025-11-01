# Use Python 3.11 slim image for smaller size
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production \
    FLASK_APP=app.py

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory for SQLite and uploads
RUN mkdir -p /app/data /app/logs && \
    chmod 755 /app/data /app/logs

# Create non-root user with matching UID/GID to frontend for shared volume access
# Frontend uses nextjs (UID 1001, GID 1001), backend uses app (UID 1001, GID 1001)
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid 1001 --create-home --shell /bin/bash app && \
    chown -R app:appgroup /app

# Ensure the shared library directory will have proper permissions
RUN mkdir -p /app/shared/library && \
    chown -R app:appgroup /app/shared && \
    chmod -R 775 /app/shared

USER app

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run the Flask application
CMD ["python", "app.py"]