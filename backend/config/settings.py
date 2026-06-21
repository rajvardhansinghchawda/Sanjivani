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

# This line allows ALL ngrok URLs automatically — add it right below:
ALLOWED_HOSTS += ['.ngrok-free.app', '.ngrok.io', '.ngrok.app', '.trycloudflare.com']
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
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = True

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
CSRF_TRUSTED_ORIGINS = [
    "https://4c7d-47-247-173-78.ngrok-free.app"
]
CORS_ALLOW_HEADERS = ['*']

CORS_ALLOW_CREDENTIALS = True
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
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     env('DB_NAME'),
        'USER':     env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST':     env('DB_HOST'),
        'PORT':     env('DB_PORT'),
    }
}

# --- Redis Cache ---
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': env('REDIS_URL'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'TIMEOUT': 300,  # 5 minutes default
    }
}

# --- Celery ---
CELERY_BROKER_URL = env('CELERY_BROKER_URL')
CELERY_RESULT_BACKEND = env('REDIS_URL')
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

# Channel layers — uses same Redis as cache but different DB index
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG' : {
            'hosts': [env('REDIS_CHANNELS_URL', default='redis://localhost:6379/2')],
            # use DB index 2 — keep separate from cache (0) and Celery (1)
        },
    },
}

# Switch WSGI → ASGI so channels can handle WebSockets
ASGI_APPLICATION = 'config.asgi.application'
TWILIO_ACCOUNT_SID  = env('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN   = env('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = env('TWILIO_PHONE_NUMBER')
BASE_WEBHOOK_URL    = env('BASE_WEBHOOK_URL')
GROQ_API_KEY = env('GROQ_API_KEY')

