from django.urls import path
from . import views

urlpatterns = [
    path('trees/',views.list_trees),
    path('trees/upload/', views.upload_tree),
    path('trees/<int:tree_id>/',views.get_tree),
]
