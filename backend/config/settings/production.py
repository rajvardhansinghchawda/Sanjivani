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
SECURE_SSL_REDIRECT             = False
SECURE_HSTS_SECONDS             = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
SECURE_HSTS_PRELOAD             = True
SESSION_COOKIE_SECURE           = True
CSRF_COOKIE_SECURE              = True

# Crucial for running behind Hugging Face Spaces / load balancers that terminate SSL
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h and h != '*'] + [
    'https://*.hf.space',
    'https://*.huggingface.co',
    'https://huggingface.co'
]

# Insert WhiteNoise middleware for serving frontend files in production
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

# Disable XFrameOptionsMiddleware to allow Hugging Face Spaces to embed the app in an iframe
if 'django.middleware.clickjacking.XFrameOptionsMiddleware' in MIDDLEWARE:
    MIDDLEWARE.remove('django.middleware.clickjacking.XFrameOptionsMiddleware')
X_FRAME_OPTIONS = 'ALLOWALL'

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
WHITENOISE_MANIFEST_STRICT = False

# Upstash Redis uses secure SSL connection (rediss://). Set SSL options for both broker and result backend.
if REDIS_URL.startswith('rediss://'):
    CELERY_BROKER_USE_SSL = {
        'ssl_cert_reqs': 'none'
    }
    # NEON: Result backend also uses Redis over TLS (not Neon DB).
    # base.py already sets CELERY_RESULT_BACKEND to redis:// — override here for rediss:// with SSL.
    CELERY_RESULT_BACKEND = REDIS_URL
    CELERY_REDIS_BACKEND_USE_SSL = {
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

# Keep the Anymail backend set in base.py if Anymail is configured, otherwise default to SMTP
if not EMAIL_BACKEND.startswith('anymail.'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'


if os.environ.get('SENTRY_DSN'):
    sentry_sdk.init(
        dsn=os.environ.get('SENTRY_DSN'),
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=0.2,
        send_default_pii=False,
    )

