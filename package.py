"""Builds dist/guidecap-<version>.zip from extension/ for upload to the Chrome Web Store.
Run: python3 package.py"""
import json, os, zipfile

root = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(root, 'extension')
version = json.load(open(os.path.join(src, 'manifest.json')))['version']
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
out = os.path.join(root, 'dist', f'guidecap-{version}.zip')

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for folder, _, files in os.walk(src):
        for f in sorted(files):
            path = os.path.join(folder, f)
            z.write(path, os.path.relpath(path, src))
print(out)
