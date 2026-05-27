"""
shared/pagination.py — Cursor and page-number paginators.
"""
from rest_framework.pagination import PageNumberPagination, CursorPagination
from rest_framework.response import Response


class StandardResultsPagination(PageNumberPagination):
    page_size             = 20
    page_size_query_param = 'page_size'
    max_page_size         = 100

    def get_paginated_response(self, data):
        return Response({
            'success': True,
            'data': data,
            'meta': {
                'count':    self.page.paginator.count,
                'next':     self.get_next_link(),
                'previous': self.get_previous_link(),
                'page':     self.page.number,
                'pages':    self.page.paginator.num_pages,
            }
        })


class TelemetryCursorPagination(CursorPagination):
    """High-volume time-series data (adherence events, audit logs)."""
    page_size             = 50
    ordering              = '-created_at'
    cursor_query_param    = 'cursor'

    def get_paginated_response(self, data):
        return Response({
            'success': True,
            'data': data,
            'meta': {
                'next':     self.get_next_link(),
                'previous': self.get_previous_link(),
            }
        })
