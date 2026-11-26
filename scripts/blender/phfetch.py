"""Descarga assets de Poly Haven. uso: phfetch.py model <id> <res> <outdir> | tex <id> <res> <outdir>"""
import json, os, sys, urllib.request
kind, aid, res, out = sys.argv[1:5]
UA={'User-Agent':'asset-build-script/1.0'}
def fetch(url): return urllib.request.urlopen(urllib.request.Request(url, headers=UA))
def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path,'wb').write(fetch(url).read())
files = json.load(fetch(f"https://api.polyhaven.com/files/{aid}"))
if kind == 'model':
    g = files['gltf'][res]['gltf']
    d = os.path.join(out, aid)
    get(g['url'], os.path.join(d, os.path.basename(g['url'])))
    for rel, inc in g.get('include', {}).items():
        get(inc['url'], os.path.join(d, rel))
    print(os.path.join(d, os.path.basename(g['url'])))
else:
    d = os.path.join(out, aid)
    for key, name in [('Diffuse','diff'),('nor_gl','nor'),('Rough','rough'),('AO','ao')]:
        if key in files and res in files[key]:
            f = files[key][res]['jpg'] if 'jpg' in files[key][res] else files[key][res]['png']
            get(f['url'], os.path.join(d, f"{name}.{f['url'].rsplit('.',1)[1]}"))
    print(d)
