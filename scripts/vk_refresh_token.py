from pathlib import Path
import json
import os
import re
import sys
import urllib.parse
import urllib.request

APP_ID = (os.environ.get('VK_APP_ID') or os.environ.get('VK_CLIENT_ID') or '').strip()
CLIENT_SECRET = (os.environ.get('VK_CLIENT_SECRET') or '').strip()
REFRESH_TOKEN = (os.environ.get('VK_REFRESH_TOKEN') or '').strip()
DEVICE_ID = (os.environ.get('VK_DEVICE_ID') or '').strip()

if not APP_ID:
    raise SystemExit('VK_APP_ID is empty')
if not CLIENT_SECRET:
    raise SystemExit('VK_CLIENT_SECRET is empty')
if not REFRESH_TOKEN:
    raise SystemExit('VK_REFRESH_TOKEN is empty')
if not DEVICE_ID:
    raise SystemExit('VK_DEVICE_ID is empty')

payload = {
    'grant_type': 'refresh_token',
    'refresh_token': REFRESH_TOKEN,
    'client_id': APP_ID,
    'client_secret': CLIENT_SECRET,
    'device_id': DEVICE_ID,
}

data = urllib.parse.urlencode(payload).encode()

req = urllib.request.Request(
    'https://id.vk.com/oauth2/auth',
    data=data,
    headers={'Content-Type': 'application/x-www-form-urlencoded'},
    method='POST',
)

body = ''
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode('utf-8', errors='ignore')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='ignore')
    Path('/tmp/vk_refresh_latest.json').write_text(body)
    print(body)
    raise SystemExit(f'VK_REFRESH_HTTP_ERROR: {e.code}')

Path('/tmp/vk_refresh_latest.json').write_text(body)

try:
    resp = json.loads(body)
except Exception:
    print(body)
    raise SystemExit('VK_REFRESH_BAD_JSON')

if resp.get('error'):
    print(json.dumps(resp, ensure_ascii=False, indent=2))
    raise SystemExit(f"VK_REFRESH_FAILED: {resp.get('error_description') or resp.get('error')}")

access_token = str(resp.get('access_token') or '').strip()
refresh_token = str(resp.get('refresh_token') or REFRESH_TOKEN).strip()

if not access_token:
    print(json.dumps(resp, ensure_ascii=False, indent=2))
    raise SystemExit('VK_REFRESH_FAILED: access_token missing')

targets = [
    Path('/opt/reputation-os/.env'),
    Path('/opt/reputation-os/apps/worker/.env'),
]

def upsert(text: str, key: str, value: str) -> str:
    pattern = rf'^{re.escape(key)}=.*$'
    line = f'{key}={value}'
    if re.search(pattern, text, flags=re.M):
        return re.sub(pattern, line, text, flags=re.M)
    if text and not text.endswith('\n'):
        text += '\n'
    return text + line + '\n'

for p in targets:
    text = p.read_text() if p.exists() else ''
    text = upsert(text, 'VK_TOKEN', access_token)
    text = upsert(text, 'VK_REFRESH_TOKEN', refresh_token)
    text = upsert(text, 'VK_DEVICE_ID', DEVICE_ID)
    p.write_text(text)
    print(f'UPDATED_ENV: {p}')

print('REFRESH_OK')
print('ACCESS_TOKEN_PREFIX:', access_token[:24])
print('ACCESS_TOKEN_LEN:', len(access_token))
print('REFRESH_TOKEN_PREFIX:', refresh_token[:24])
print('REFRESH_TOKEN_LEN:', len(refresh_token))
print('DEVICE_ID:', DEVICE_ID)
