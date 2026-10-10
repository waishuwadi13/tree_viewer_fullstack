

def parse_brace_code(content, filename):
    root = {'author': '-', 'text': filename, 'permalink': None, 'children': []}
    stack = [(root, None)]
    prev_line_text_node = None
    pending_close_parent = None

    def make_node(text):
        return {'author': '-', 'text': text, 'permalink': None, 'children': []}

    for line in content.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue

        tokens = []
        buf = ''
        for ch in trimmed:
            if ch in '{}':
                if buf.strip():
                    tokens.append(('text', buf.strip()))
                tokens.append(('open' if ch == '{' else 'close', ch))
                buf = ''
            else:
                buf += ch
        if buf.strip():
            tokens.append(('text', buf.strip()))

        last_text_node = None

        for kind, val in tokens:
            if kind == 'text':
                if val == ';' and pending_close_parent is not None:
                    node = make_node(';')
                    pending_close_parent['children'].append(node)
                else:
                    node = make_node(val)
                    stack[-1][0]['children'].append(node)
                last_text_node = node
                prev_line_text_node = node
                pending_close_parent = None

            elif kind == 'open':
                brace_node = make_node('{')
                attach_to = last_text_node or prev_line_text_node
                true_parent = attach_to or stack[-1][0]
                true_parent['children'].append(brace_node)
                stack.append((brace_node, true_parent))
                last_text_node = None
                prev_line_text_node = None
                pending_close_parent = None

            else:
                close_node = make_node('}')
                if len(stack) > 1:
                    opened, close_parent = stack.pop()
                    true_parent = close_parent or root
                    true_parent['children'].append(close_node)
                    pending_close_parent = true_parent
                else:
                    stack[-1][0]['children'].append(close_node)
                    pending_close_parent = stack[-1][0]
                last_text_node = None
                prev_line_text_node = None

    return {'title': filename, 'filename': filename, 'root': root}
