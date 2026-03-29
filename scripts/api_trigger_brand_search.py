import json
import urllib.request
import urllib.error

BASE = 'http://127.0.0.1:4010/api'
EMAIL = 'demo@reputation.local'
PASSWORD = 'demo123'
COMPANY_ID = 'cmn6h2vpi0005q62kulp0fb0i'

def do_request(url, data=None, headers=None, method='GET'):
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers or {},
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='ignore')

print('=== LOGIN ===')
status, body = do_request(
    BASE + '/auth/login',
    data=json.dumps({
        'email': EMAIL,
        'password': PASSWORD,
    }).encode(),
    headers={'Content-Type': 'application/json'},
    method='POST',
)
print('STATUS:', status)
print('BODY:', body)

if status != 201:
    raise SystemExit('LOGIN_FAILED')

login_json = json.loads(body)
access_token = login_json.get('accessToken')
if not access_token:
    raise SystemExit('NO_ACCESS_TOKEN_IN_LOGIN_RESPONSE')

auth_headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json',
}

print()
print('=== AUTH ME ===')
status, body = do_request(
    BASE + '/auth/me',
    headers={'Authorization': f'Bearer {access_token}'},
    method='GET',
)
print('STATUS:', status)
print('BODY:', body)

print()
print('=== RUN BRAND SEARCH ===')
status, body = do_request(
    BASE + f'/companies/{COMPANY_ID}/vk/run-brand-search',
    data=b'{}',
    headers=auth_headers,
    method='POST',
)
print('STATUS:', status)
print('BODY:', body)
