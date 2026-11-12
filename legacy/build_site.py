from pathlib import Path

root = Path(__file__).resolve().parent
page = (root / 'page.html').read_text(encoding='utf8')
shell = (root / 'shell.html').read_text(encoding='utf8')

i, j = page.index('<script>'), page.rindex('</script>')
body, script = page[:i], page[i + len('<script>'):j]
body = body.replace('<meta name="dash-one-writer">\n', '')
i = body.index('<style>')
k = body.index('</style>') + len('</style>')
style, markup = body[i:k], body[k:]

out = shell.replace('</head>', style + '\n</head>')
out = out.replace('<template id="legacy-page-body"></template>', markup)
out = out.replace('void "legacy-page-script";', script)
(root / 'index.html').write_text(out, encoding='utf8')
print('index.html gerado:', len(out), 'bytes')
