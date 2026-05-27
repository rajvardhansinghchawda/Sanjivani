# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend configuration files
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Copy all frontend source files
COPY frontend/ ./

# Build the frontend using relative API URLs for production
# This ensures that API and WebSocket requests are routed to the HF Space domain
RUN VITE_API_URL=/api/v1 npm run build

# Stage 2: Build the Python backend and assemble
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    PORT=7860

WORKDIR /app

# Install system dependencies (gcc, postgreSQL client, cairo, etc.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libpq-dev \
        curl \
        pkg-config \
        libcairo2-dev \
        libpango1.0-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --upgrade pip \
    && pip install -r /app/backend/requirements.txt

# Copy python backend code
COPY backend/ /app/backend/

# Copy compiled React frontend assets from Stage 1 builder
COPY --from=frontend-builder /app/backend/staticfiles/ /app/backend/staticfiles/

# Copy startup shell script and make it executable
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Hugging Face Spaces run as non-root user (UID 1000)
# Create a user and grant access to the /app directory so celerybeat can write pid files
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose Space port (HF uses 7860)
EXPOSE 7860

# Start up using start.sh script
CMD ["/app/start.sh"]
