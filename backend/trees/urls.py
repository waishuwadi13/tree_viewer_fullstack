from django.urls import path
from . import views

urlpatterns = [
    path('trees/upload/', views.upload_tree),
]
