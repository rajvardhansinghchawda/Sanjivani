from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']

# Accept comma-separated origins via env when provided, else fall back to common dev ports.
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()] or [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
CORS_ALLOW_CREDENTIALS = True


# Use console email backend only if no SMTP credentials are configured.
# If EMAIL_HOST_USER is set in .env, use SMTP so real emails (OTP, verification) arrive.
if not os.environ.get('EMAIL_HOST_USER'):
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Run Celery tasks synchronously in development (no worker needed).
# NOTE: .delay() calls block the caller — EMAIL_TIMEOUT=8s in base.py limits SMTP hangs.
CELERY_TASK_ALWAYS_EAGER = True

# Use Redis channel layer when running in Docker (REDIS_URL is set to redis://redis:6379/0).
# Falls back to InMemory only when Redis is unavailable (bare local dev without Docker).
if os.environ.get('REDIS_URL'):
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [os.environ['REDIS_URL']],
            },
        },
    }

# Allow WebSocket connections from all origins in dev (Cloudflare tunnel + localhost)
CORS_ALLOW_ALL_ORIGINS = True