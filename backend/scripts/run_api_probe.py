"""Standalone script to probe API endpoints and write reports.

Run with: `python medadhere_backend/scripts/run_api_probe.py` from repo root.
"""
import os
import re
import django
from django.urls import get_resolver


def gather_urls():
    resolver = get_resolver(None)
    urls = []

    def walk(prefix, patterns):
        for p in patterns:
            if getattr(p, 'url_patterns', None):
                route = getattr(p, 'pattern', None)
                try:
                    seg = route._route if route is not None else ''
                except Exception:
                    seg = str(route) if route is not None else ''
                new_prefix = (prefix + '/' + seg).replace('//', '/')
                walk(new_prefix, p.url_patterns)
            else:
                route = getattr(p, 'pattern', None)
                if route is None:
                    continue
                try:
                    seg = route._route
                except Exception:
                    seg = str(route)
                path = (prefix + '/' + seg).replace('//', '/')
                urls.append(path)

    walk('', resolver.url_patterns)

    def fill(path):
        path = re.sub(r'<[^>]+>', '1', path)
        if not path.startswith('/'):
            path = '/' + path
        if not path.endswith('/'):
            path = path + '/'
        return path

    cleaned = sorted(set(fill(u) for u in urls if u and 'admin' not in u and 'static' not in u))
    return cleaned


def main():
    # Use same settings path as manage.py when running from the medadhere_backend folder
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
    django.setup()

    from rest_framework.test import APIClient

    client = APIClient()
    urls = gather_urls()
    results = []

    for u in urls:
        try:
            resp = client.get(u)
            code = resp.status_code
        except Exception as e:
            code = f'ERROR: {e}'
        results.append((u, code))

    os.makedirs('reports', exist_ok=True)
    report_path = os.path.join('reports', 'api_endpoints_report.md')
    summary_path = os.path.join('reports', 'api_endpoints_summary.md')

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write('# API Endpoints Probe Report\n\n')
        f.write('| Endpoint | Status |\n')
        f.write('|---|---:|\n')
        for u, code in results:
            f.write(f'| {u} | {code} |\n')

    successes = [r for r in results if isinstance(r[1], int) and 200 <= r[1] < 300]
    failures = [r for r in results if not (isinstance(r[1], int) and 200 <= r[1] < 300)]

    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write('# API Endpoints Summary\n\n')
        f.write(f'Total endpoints: {len(results)}\n\n')
        f.write(f'Successful (2xx): {len(successes)}\n')
        f.write(f'Failures / errors: {len(failures)}\n\n')
        if failures:
            f.write('## Failures\n\n')
            for u, code in failures:
                f.write(f'- {u} → {code}\n')

    print('Reports written:', report_path, summary_path)


if __name__ == '__main__':
    main()
