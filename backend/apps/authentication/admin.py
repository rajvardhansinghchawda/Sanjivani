from django.contrib import admin
from .models import User

# Register the User model which handles Reception, Supervisor, Admin, etc.
admin.site.register(User)
