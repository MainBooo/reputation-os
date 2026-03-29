import json, os, re
from pathlib import Path

data = json.loads(Path('/tmp/vk_token.json').read_text())
token = data.get('access_token')
if not token:
    raise SystemExit(f'No access_token in /tmp/vk_token.json: {data}')

pairs = {
    'VK_APP_ID': os.environ['VK_APP_ID'],
    'VK_CLIENT_SECRET': os.environ['VK_CLIENT_SECRET'],
    'VK_REDIRECT_URI': os.environ['VK_REDIRECT_URI'],
    'VK_TOKEN': token,
}

files = [
    Path('/opt/reputation-os/.env'),
    Path('/opt/reputation-os/apps/worker/.env'),
]

def upsert(text: str, key: str, value: str) -> str:
    line = f'{key}={value}'
    pattern = re.compile(rf'^{re.escape(key)}=.*$', re.M)
    if pattern.search(text):
        return pattern.sub(line, text)
    if text and not text.endswith('\n'):
        text += '\n'
    return text + line + '\n'

for path in files:
    text = path.read_text() if path.exists() else ''
    for key, value in pairs.items():
        text = upsert(text, key, value)
    path.write_text(text)

print('UPDATED_FILES:')
for path in files:
    print(path)
print('TOKEN_PREFIX:', token[:24])
