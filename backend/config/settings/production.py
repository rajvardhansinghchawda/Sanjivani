from .base import *
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

DEBUG = False

# Fall back to '*' if ALLOWED_HOSTS is empty/not configured
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '').split(',') if h.strip()] or ['*']

cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if cors_origins_env and cors_origins_env != '*':
    CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_origins_env.split(',') if o.strip()]
else:
    CORS_ALLOW_ALL_ORIGINS = True

# HTTPS settings
SECURE_SSL_REDIRECT             = True
SECURE_HSTS_SECONDS             = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
SECURE_HSTS_PRELOAD             = True
SESSION_COOKIE_SECURE           = True
CSRF_COOKIE_SECURE              = True

# Crucial for running behind Hugging Face Spaces / load balancers that terminate SSL
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h and h != '*'] or ['https://*.hf.space']

# Insert WhiteNoise middleware for serving frontend files in production
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
WHITENOISE_MANIFEST_STRICT = False

# Upstash Redis uses secure SSL connection (rediss://)
if REDIS_URL.startswith('rediss://'):
    CELERY_BROKER_USE_SSL = {
        'ssl_cert_reqs': 'none'
    }

if REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [REDIS_URL],
            },
        },
    }

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

if os.environ.get('SENTRY_DSN'):
    sentry_sdk.init(
        dsn=os.environ.get('SENTRY_DSN'),
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=0.2,
        send_default_pii=False,
    )

