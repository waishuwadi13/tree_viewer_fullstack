from bs4 import BeautifulSoup


def parse_things(container, parent_node):
    for thing in container.select(':scope > .thing.comment'):
        author = thing.get('data-author', '[deleted]')

        md = (
            thing.select_one(':scope > .entry .usertext-body .md')
            or thing.select_one('.usertext-body .md')
            or thing.select_one('.md')
            or thing.select_one('.usertext-body')
        )
        text = ' '.join(md.get_text().split()) if md else ''

        if not text:
            body = thing.select_one('.usertext-body')
            if body and '[deleted]' in body.get_text():
                text = '[deleted]'
            elif body and '[removed]' in body.get_text():
                text = '[removed]'

        perm_el = (
            thing.select_one('a[data-event-action="permalink"]')
            or thing.select_one('.entry .flat-list a[href*="/comments/"]')
        )
        permalink = perm_el.get('href') if perm_el else None

        node = {
            'author': author,
            'text': text,
            'permalink': permalink,
            'children': [],
        }
        parent_node['children'].append(node)

        child_listing = thing.select_one(':scope > .child > .sitetable')
        if child_listing:
            parse_things(child_listing, node)


def parse_reddit_html(html, filename):
    soup = BeautifulSoup(html, 'lxml')

    title_el = (
        soup.select_one('a.title')
        or soup.select_one('[data-event-action="title"]')
        or soup.select_one('.top-matter .title a')
        or soup.select_one('h1')
        or soup.select_one('title')
    )
    title = title_el.get_text(strip=True) if title_el else filename

    post = (
        soup.select_one('.thing[data-type="link"]')
        or soup.select_one('.thing.link')
        or soup.select_one('[data-fullname^="t3_"]')
    )
    post_author = post.get('data-author', 'thread') if post else 'thread'

    root = {
        'author': post_author,
        'text': title,
        'permalink': None,
        'children': [],
    }

    comment_area = (
        soup.select_one('.commentarea > .sitetable')
        or soup.select_one('.commentarea .nestedlisting')
        or soup.select_one('.commentarea')
        or soup.select_one('.nestedlisting')
        or soup.select_one('#siteTable')
        or soup.select_one('.comments')
    )
    if comment_area:
        parse_things(comment_area, root)

    return {'title': title, 'filename': filename, 'root': root}


def count_nodes(node):
    return 1 + sum(count_nodes(child) for child in node['children'])
