from rest_framework import serializers
from .models import HardwareProduct, HardwareOrder, DeviceUniqueID


class HardwareProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = HardwareProduct
        fields = ['id', 'name', 'sku', 'price', 'description', 'specs', 'stock_count', 'is_available', 'image_url']


class HardwareOrderSerializer(serializers.ModelSerializer):
    product = HardwareProductSerializer(read_only=True)
    product_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = HardwareOrder
        fields = [
            'id', 'product', 'product_id', 'quantity', 'total_price',
            'status', 'shipping_address', 'payment_id', 'shipped_at', 'tracking_number', 'created_at',
        ]
        read_only_fields = ['total_price', 'status', 'shipped_at', 'tracking_number']

    def create(self, validated_data):
        product = HardwareProduct.objects.get(id=validated_data.pop('product_id'))
        quantity = validated_data.get('quantity', 1)
        total_price = product.price * quantity
        return HardwareOrder.objects.create(
            product=product, total_price=total_price, **validated_data
        )
