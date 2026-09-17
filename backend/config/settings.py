# config/settings.py
import environ
from pathlib import Path

env = environ.Env(DEBUG=(bool, False))

BASE_DIR = Path(__file__).resolve().parent.parent
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
# config/settings.py

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# This line allows ALL ngrok, Cloudflare, and Render URLs automatically:
ALLOWED_HOSTS += ['.ngrok-free.app', '.ngrok.io', '.ngrok.app', '.trycloudflare.com', '.onrender.com']
# --- Apps ---
DJANGO_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
                               # ← must be first
    
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'channels',  
    'corsheaders',
]

LOCAL_APPS = [
    'apps.authentication',
    'apps.hospitals',
    'apps.beds',
    'apps.patients',
    'apps.ambulances',
    'apps.supervisors',
    'apps.analytics',
    'apps.notifications',
    'apps.calls',
    'apps.resources',
    'apps.triage',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = ['*']
CORS_EXPOSE_HEADERS = ['*']
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.onrender\.com$",
    r"^https://.*\.ngrok-free\.app$",
    r"^https://.*\.trycloudflare\.com$",
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
CSRF_TRUSTED_ORIGINS = [
    "https://*.ngrok-free.app",
    "https://*.trycloudflare.com",
    "https://*.onrender.com",
    "https://4c7d-47-247-173-78.ngrok-free.app",
]
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# --- Database ---
if env('DATABASE_URL', default=None):
    DATABASES = {
        'default': env.db('DATABASE_URL')
    }
    DATABASES['default'].setdefault('OPTIONS', {})
    if 'sslmode' not in DATABASES['default']['OPTIONS'] and env('DB_SSLMODE', default=None):
        DATABASES['default']['OPTIONS']['sslmode'] = env('DB_SSLMODE')
else:
    db_options = {}
    if env('DB_SSLMODE', default=None):
        db_options['sslmode'] = env('DB_SSLMODE')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME':     env('DB_NAME'),
            'USER':     env('DB_USER'),
            'PASSWORD': env('DB_PASSWORD'),
            'HOST':     env('DB_HOST'),
            'PORT':     env('DB_PORT', default='5432'),
            'OPTIONS':  db_options,
        }
    }

# --- Redis Cache ---
redis_url = env('REDIS_URL', default=None)
if redis_url and str(redis_url).startswith('redis://'):
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': redis_url,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            },
            'TIMEOUT': 300,  # 5 minutes default
        }
    }
    CELERY_BROKER_URL = env('CELERY_BROKER_URL', default=redis_url)
    CELERY_RESULT_BACKEND = redis_url
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'sanjivani-cache',
        }
    }
    CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='memory://')
    CELERY_RESULT_BACKEND = 'cache+memory://'

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'

# --- DRF ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',  # Changed from IsAuthenticated
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
}

# --- JWT ---
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# --- Custom User Model (you'll create this in Phase 2) ---
AUTH_USER_MODEL = 'authentication.User'

# --- Static & Media ---
STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
MEDIA_URL   = '/media/'
MEDIA_ROOT  = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True
 

from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # every hour — check beds occupied > 20 days
    'check-long-occupancy': {
        'task'    : 'apps.supervisors.tasks.check_long_occupancy_beds',
        'schedule': crontab(minute=0),          # top of every hour
    },
    # every 4 hours — check resource mismatches
    'check-resource-mismatches': {
        'task'    : 'apps.supervisors.tasks.check_resource_mismatches',
        'schedule': crontab(minute=0, hour='*/4'),
    },
    # daily at 9am — check pending verifications
    'check-verifications': {
        'task'    : 'apps.supervisors.tasks.check_pending_hospital_verifications',
        'schedule': crontab(minute=0, hour=9),
    },
    # every 2 hours — check transfer delays
    'check-transfer-delays': {
        'task'    : 'apps.supervisors.tasks.check_transfer_delays',
        'schedule': crontab(minute=0, hour='*/2'),
    },

    'check-missing-resource-updates': {
        'task'    : 'apps.supervisors.tasks.check_missing_resource_updates',
        'schedule': crontab(minute=0),   # every hour, same as long-occupancy check
    },
}

# Channel layers — uses Redis if available, else fallback to InMemoryChannelLayer
redis_channels_url = env('REDIS_CHANNELS_URL', default=redis_url if redis_url else None)
if redis_channels_url and str(redis_channels_url).startswith('redis://'):
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG' : {
                'hosts': [redis_channels_url],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }

# Switch WSGI → ASGI so channels can handle WebSockets
ASGI_APPLICATION = 'config.asgi.application'
TWILIO_ACCOUNT_SID  = env('TWILIO_ACCOUNT_SID', default='')
TWILIO_AUTH_TOKEN   = env('TWILIO_AUTH_TOKEN', default='')
TWILIO_PHONE_NUMBER = env('TWILIO_PHONE_NUMBER', default='')
BASE_WEBHOOK_URL    = env('BASE_WEBHOOK_URL', default='')
GROQ_API_KEY        = env('GROQ_API_KEY', default='')

