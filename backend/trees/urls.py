from django.urls import path
from . import views

urlpatterns = [
    path('trees/',views.list_trees),
    path('trees/upload/', views.upload_tree),
]
