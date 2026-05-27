from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from shared.response import APIResponse
from .models import HardwareProduct, HardwareOrder
from .serializers import HardwareProductSerializer, HardwareOrderSerializer


class ProductListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        products = HardwareProduct.objects.filter(is_available=True, deleted_at__isnull=True)
        return APIResponse.success(HardwareProductSerializer(products, many=True).data)


class ProductDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        product = get_object_or_404(HardwareProduct, id=pk, is_available=True)
        return APIResponse.success(HardwareProductSerializer(product).data)


class OrderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = HardwareOrder.objects.filter(user=request.user).order_by('-created_at')
        return APIResponse.success(HardwareOrderSerializer(orders, many=True).data)

    def post(self, request):
        serializer = HardwareOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return APIResponse.error(serializer.errors, status=400)
        order = serializer.save(user=request.user)
        return APIResponse.success(HardwareOrderSerializer(order).data, status=201)


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        order = get_object_or_404(HardwareOrder, id=pk, user=request.user)
        return APIResponse.success(HardwareOrderSerializer(order).data)


class OrderCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(HardwareOrder, id=pk, user=request.user)
        if order.status not in ('PENDING', 'CONFIRMED'):
            return APIResponse.error("Order cannot be cancelled at this stage.", status=400)
        order.status = 'CANCELLED'
        order.save(update_fields=['status'])
        return APIResponse.success(HardwareOrderSerializer(order).data, message="Order cancelled.")
