from django.contrib import admin
from .models import HardwareProduct, HardwareOrder, DeviceUniqueID


@admin.register(HardwareProduct)
class HardwareProductAdmin(admin.ModelAdmin):
    list_display  = ['name', 'sku', 'price', 'stock_count', 'is_available']
    list_filter   = ['is_available']
    search_fields = ['name', 'sku']


@admin.register(HardwareOrder)
class HardwareOrderAdmin(admin.ModelAdmin):
    list_display  = ['id', 'user', 'product', 'quantity', 'status', 'created_at']
    list_filter   = ['status']
    search_fields = ['user__email']


@admin.register(DeviceUniqueID)
class DeviceUniqueIDAdmin(admin.ModelAdmin):
    list_display  = ['unique_code', 'is_provisioned', 'product', 'created_at']
    list_filter   = ['is_provisioned']
    search_fields = ['unique_code']
    readonly_fields = ['created_at', 'manufactured_at']
