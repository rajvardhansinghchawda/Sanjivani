#!/bin/sh
set -eu

wait_for_db() {
  python - <<'PY'
import os
import sys
import time

import psycopg

host = os.environ.get('DB_HOST', 'db')
port = os.environ.get('DB_PORT', '5432')
name = os.environ.get('DB_NAME', 'medadhere')
user = os.environ.get('DB_USER', 'postgres')
password = os.environ.get('DB_PASSWORD', 'root')

for attempt in range(1, 61):
    try:
        conn = psycopg.connect(
            host=host,
            port=port,
            dbname=name,
            user=user,
            password=password,
        )
        conn.close()
        sys.exit(0)
    except Exception:
        time.sleep(2)

print('Database is not ready after waiting.', file=sys.stderr)
sys.exit(1)
PY
}

wait_for_redis() {
  python - <<'PY'
import os
import sys
import time

import redis

url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
client = redis.from_url(url)

for attempt in range(1, 61):
    try:
        if client.ping():
            sys.exit(0)
    except Exception:
        time.sleep(2)

print('Redis is not ready after waiting.', file=sys.stderr)
sys.exit(1)
PY
}

if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
  wait_for_db
fi

if [ "${WAIT_FOR_REDIS:-true}" = "true" ]; then
  wait_for_redis
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  python manage.py migrate --noinput
  python scripts/seed_all_data.py
  python scripts/seed_permissions.py
fi

exec "$@"
