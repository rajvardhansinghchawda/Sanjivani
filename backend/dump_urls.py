import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.urls import get_resolver, URLPattern, URLResolver

def get_urls(patterns, prefix=''):
    result = []
    for p in patterns:
        if isinstance(p, URLPattern):
            url_name = getattr(p, 'name', '') or ''
            result.append(f"{prefix}{p.pattern} [name='{url_name}']")
        elif isinstance(p, URLResolver):
            result.extend(get_urls(p.url_patterns, prefix + str(p.pattern)))
    return result

urls = get_urls(get_resolver().url_patterns)
for url in sorted(set(urls)):
    if url.startswith('api/'):
        print('/' + url)
