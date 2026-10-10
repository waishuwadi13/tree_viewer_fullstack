from .models import Tree, Node


def save_tree(parsed, source_type):
    tree = Tree.objects.create(
        title=parsed['title'],
        filename=parsed['filename'],
        source_type=source_type,
    )

    def save_node(node_dict, parent, position):
        node = Node.objects.create(
            tree=tree,
            parent=parent,
            author=node_dict['author'],
            text=node_dict['text'],
            permalink=node_dict['permalink'],
            position=position,
        )
        for i, child in enumerate(node_dict['children']):
            save_node(child, node, i)

    save_node(parsed['root'], None, 0)
    return tree


def build_tree(tree):
    nodes = tree.nodes.order_by('position')

    children_of = {}
    for n in nodes:
        children_of.setdefault(n.parent_id, []).append(n)

    def build(node, address, depth):
        kids = children_of.get(node.id, [])
        return {
            'id': node.id,
            'author': node.author,
            'text': node.text,
            'permalink': node.permalink,
            'depth': depth,
            'address': address,
            'children': [
                build(child, f'{address}.{i + 1}', depth + 1)
                for i, child in enumerate(kids)
            ],
        }

    root = children_of[None][0]
    return {
        'id': tree.id,
        'title': tree.title,
        'filename': tree.filename,
        'root': build(root, '1', 0),
    }
