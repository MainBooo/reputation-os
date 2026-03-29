import os, json, urllib.parse, urllib.request, urllib.error
from pathlib import Path

meta = json.loads(Path('/tmp/vk_vkid_pkce.json').read_text())

payload = {
    'grant_type': 'authorization_code',
    'client_id': os.environ['VK_APP_ID'],
    'client_secret': os.environ['VK_CLIENT_SECRET'],
    'redirect_uri': os.environ['VK_REDIRECT_URI'],
    'code': os.environ['VK_CODE'],
    'device_id': os.environ['VK_DEVICE_ID'],
    'code_verifier': meta['code_verifier'],
}

data = urllib.parse.urlencode(payload).encode()
req = urllib.request.Request(
    'https://id.vk.com/oauth2/auth',
    data=data,
    headers={'Content-Type': 'application/x-www-form-urlencoded'},
    method='POST',
)

try:
    with urllib.request.urlopen(req) as r:
        print(r.read().decode('utf-8', errors='ignore'))
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='ignore')
    print(body)
    raise
