from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Tree
from .code_parser import parse_brace_code
from .parsers import parse_reddit_html
from .services import save_tree, build_tree


@api_view(['GET'])
def list_trees(request):
    trees = Tree.objects.order_by('-uploaded_at')
    data = [
        {
            'id': t.id,
            'title': t.title,
            'filename': t.filename,
            'source_type': t.source_type,
            'uploaded_at': t.uploaded_at,
        }
        for t in trees
    ]
    return Response(data)


@api_view(['GET'])
def get_tree(request, tree_id):
    tree = get_object_or_404(Tree, id=tree_id)
    return Response(build_tree(tree))


@api_view(['POST'])
def upload_tree(request):
    file = request.FILES.get('file')
    if file is None:
        return Response({'error': 'No file sent'}, status=400)

    content = file.read().decode('utf-8')
    name = file.name.lower()

    if name.endswith('.html'):
        parsed = parse_reddit_html(content, file.name)
        tree = save_tree(parsed, 'reddit')
    elif name.endswith('.c'):
        parsed = parse_brace_code(content, file.name)
        tree = save_tree(parsed, 'code')
    else:
        return Response({'error': 'Only .html and .c files supported'}, status=400)

    return Response({'id': tree.id, 'title': tree.title}, status=201)
