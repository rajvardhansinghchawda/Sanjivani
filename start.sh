#!/bin/sh
set -e

# Change directory to backend folder
cd /app/backend

echo "Starting Sanjivani production initialization..."

# Wait for DB if HOST is specified
if [ -n "${DB_HOST:-}" ]; then
  echo "Checking database connection on $DB_HOST..."
  python - <<'PY'
import os
import sys
import time
import psycopg

host = os.environ.get('DB_HOST', '')
port = os.environ.get('DB_PORT', '5432')
name = os.environ.get('DB_NAME', '')
user = os.environ.get('DB_USER', '')
password = os.environ.get('DB_PASSWORD', '')

if not host or not name:
    print("DB_HOST or DB_NAME not set. Skipping wait check.")
    sys.exit(0)

for attempt in range(1, 31):
    try:
        conn = psycopg.connect(
            host=host,
            port=port,
            dbname=name,
            user=user,
            password=password,
            connect_timeout=3
        )
        conn.close()
        print("Database connection successful.")
        sys.exit(0)
    except Exception as e:
        print(f"Database not ready yet (attempt {attempt}/30): {e}")
        time.sleep(2)

print('Database is not ready after waiting. Exiting.', file=sys.stderr)
sys.exit(1)
PY
fi

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Run seeders (safe/idempotent checks in project)
if [ "${RUN_SEEDERS:-true}" = "true" ]; then
  echo "Running database seeders..."
  python scripts/seed_all_data.py || echo "Warning: seed_all_data.py failed, continuing..."
  python scripts/seed_permissions.py || echo "Warning: seed_permissions.py failed, continuing..."
fi

# Collect static files
echo "Collecting static files (WhiteNoise)..."
python manage.py collectstatic --noinput

# Start Celery worker in the background
echo "Starting Celery worker..."
celery -A config worker -l info --concurrency=2 &

# Start Celery beat in the background
echo "Starting Celery beat..."
celery -A config beat -l info --pidfile=/tmp/celerybeat.pid &

# Start Daphne in the foreground (bind to port 7860 for Hugging Face)
echo "Starting Daphne ASGI server on port 7860..."
exec daphne -b 0.0.0.0 -p 7860 config.asgi:application
