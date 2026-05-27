from django.urls import path
from .views import ProductListView, ProductDetailView, OrderListCreateView, OrderDetailView, OrderCancelView

urlpatterns = [
    path('products/',               ProductListView.as_view(),    name='store-product-list'),
    path('products/<uuid:pk>/',     ProductDetailView.as_view(),  name='store-product-detail'),
    path('orders/',                 OrderListCreateView.as_view(),name='store-order-list'),
    path('orders/<uuid:pk>/',       OrderDetailView.as_view(),    name='store-order-detail'),
    path('orders/<uuid:pk>/cancel/',OrderCancelView.as_view(),    name='store-order-cancel'),
]
