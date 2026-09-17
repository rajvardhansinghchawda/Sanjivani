# Stage 1: Build Frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend/hospital
# Copy package files and install dependencies
COPY frontend/hospital/package*.json ./
RUN npm install
# Copy the rest of the frontend code and build
COPY frontend/hospital/ ./
RUN npm run build

# Stage 2: Setup Backend and Nginx
FROM python:3.11-slim

# Install Nginx and Supervisor
RUN apt-get update && \
    apt-get install -y nginx supervisor && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend code
COPY backend/ ./backend/

# Copy built frontend static files from Stage 1
COPY --from=frontend-builder /app/frontend/hospital/dist /app/frontend/dist

# Copy Configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set Permissions (HuggingFace spaces run as non-root user id 1000)
RUN mkdir -p /var/log/supervisor /var/run/supervisor /var/log/nginx /var/lib/nginx
RUN chmod -R 777 /var/log/supervisor /var/run/supervisor /var/log/nginx /var/lib/nginx /tmp
RUN chmod 777 /etc/nginx/nginx.conf

# Expose default HF port
EXPOSE 7860

# Switch to non-root user
USER 1000

# Start Supervisor which handles both Django and Nginx
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
