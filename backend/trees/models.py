from django.db import models

class Tree(models.Model):
    title = models.CharField(max_length=500)
    filename = models.CharField(max_length=255)
    source_type = models.CharField(max_length=20)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class Node(models.Model):
    tree = models.ForeignKey(Tree, on_delete=models.CASCADE, related_name='nodes')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    author = models.CharField(max_length=255, blank=True)
    text = models.TextField(blank=True)
    permalink = models.URLField(max_length=1000, blank=True, null=True)
    position = models.IntegerField(default=0)
