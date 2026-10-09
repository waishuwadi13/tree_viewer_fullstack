from .models import Tree,Node

def save_tree(parsed,source_type):
	tree = Tree.objects.create(
		title = parsed['title'],
		filename = parsed['filename'],
		source_type = source_type,
	)

	def save_node(node_dict,parent,position):
		node = Node.objects.create(
			tree = tree,
			parent = parent,
			author = node_dict['author'],
			text = node_dict['text'],
			permalink = node_dict['permalink'],
			position = position,
		)
 		
		for i,child in enumerate(node_dict['children']):
			save_node(child,node,i)

	save_node(parsed['root'],None,0)
	return tree
