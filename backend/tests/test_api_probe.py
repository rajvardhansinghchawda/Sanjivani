from django.test import TestCase
from rest_framework.test import APIClient
from django.urls import get_resolver
import re
import os


class APIProbe(TestCase):
    """Probe all registered URL routes with GET and write a Markdown report.

    This test intentionally never fails; it is used to enumerate endpoints
    and record status codes so a human can inspect the results.
    """

    def _gather_urls(self):
        resolver = get_resolver(None)
        urls = []

        def walk(prefix, patterns):
            for p in patterns:
                # include() objects expose .url_patterns
                if getattr(p, 'url_patterns', None):
                    # extract a readable route fragment when available
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

        # normalize and replace converters like <int:pk> with a safe value
        def fill(path):
            path = re.sub(r'<[^>]+>', '1', path)
            if not path.startswith('/'):
                path = '/' + path
            # prefer trailing slash to match Django default
            if not path.endswith('/'):
                path = path + '/'
            return path

        cleaned = sorted(set(fill(u) for u in urls if u and 'admin' not in u and 'static' not in u))
        return cleaned

    def test_probe_endpoints(self):
        client = APIClient()
        urls = self._gather_urls()
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
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write('# API Endpoints Probe Report\n\n')
            f.write('| Endpoint | Status |\n')
            f.write('|---|---:|\n')
            for u, code in results:
                f.write(f'| {u} | {code} |\n')

        # keep the test green — the report is the artifact we care about
        self.assertTrue(True)
