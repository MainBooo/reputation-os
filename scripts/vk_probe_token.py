import os
import json
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

ROOT_ENV = Path('/opt/reputation-os/.env')
WORKER_ENV = Path('/opt/reputation-os/apps/worker/.env')

def read_env_value(path: Path, key: str) -> str:
    if not path.exists():
        return ''
    for line in path.read_text().splitlines():
        if line.startswith(key + '='):
            return line.split('=', 1)[1].strip()
    return ''

token = os.environ.get('VK_TOKEN') or read_env_value(WORKER_ENV, 'VK_TOKEN') or read_env_value(ROOT_ENV, 'VK_TOKEN')
if not token:
    raise SystemExit('NO_VK_TOKEN')

tests = [
    ('users.get', {'v': '5.131'}),
    ('newsfeed.search', {'q': 'Acme', 'count': '3', 'v': '5.131'}),
    ('wall.search', {'query': 'Acme', 'count': '3', 'owners_only': '0', 'v': '5.131'}),
]

for method, params in tests:
    params = dict(params)
    params['access_token'] = token
    url = 'https://api.vk.com/method/' + method + '?' + urllib.parse.urlencode(params)

    print(f'=== {method} ===')
    try:
        with urllib.request.urlopen(url) as r:
            body = r.read().decode('utf-8', errors='ignore')
            print(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        print(body)
    print()
