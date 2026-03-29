import os, json, secrets, hashlib, base64, urllib.parse
from pathlib import Path

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

code_verifier = b64url(secrets.token_bytes(64))
code_challenge = b64url(hashlib.sha256(code_verifier.encode()).digest())
state = b64url(secrets.token_bytes(24))

payload = {
    'code_verifier': code_verifier,
    'state': state,
}
Path('/tmp/vk_vkid_pkce.json').write_text(json.dumps(payload))

params = {
    'response_type': 'code',
    'client_id': os.environ['VK_APP_ID'],
    'redirect_uri': os.environ['VK_REDIRECT_URI'],
    'scope': os.environ.get('VK_SCOPE', 'vkid.personal_info wall offline'),
    'state': state,
    'prompt': 'login',
    'code_challenge': code_challenge,
    'code_challenge_method': 'S256',
}

print('https://id.vk.com/authorize?' + urllib.parse.urlencode(params))
