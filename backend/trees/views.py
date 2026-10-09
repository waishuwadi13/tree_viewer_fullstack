from rest_framework.decorators import api_view
from rest_framework.response import Response

from .parsers import parse_reddit_html
from .services import save_tree


@api_view(['POST'])
def upload_tree(request):
    file = request.FILES.get('file')
    if file is None:
        return Response({'error': 'No file sent'}, status=400)

    content = file.read().decode('utf-8')

    if file.name.lower().endswith('.html'):
        parsed = parse_reddit_html(content, file.name)
        tree = save_tree(parsed, 'reddit')
    else:
        return Response({'error': 'Only .html files supported for now'}, status=400)

    return Response({'id': tree.id, 'title': tree.title}, status=201)
