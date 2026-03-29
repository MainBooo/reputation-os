import os, urllib.parse, urllib.request

params = {
    'client_id': os.environ['VK_APP_ID'],
    'client_secret': os.environ['VK_CLIENT_SECRET'],
    'redirect_uri': os.environ['VK_REDIRECT_URI'],
    'code': os.environ['VK_CODE'],
    'v': os.environ.get('VK_API_VERSION', '5.131'),
}

url = 'https://oauth.vk.com/access_token?' + urllib.parse.urlencode(params)

with urllib.request.urlopen(url) as r:
    print(r.read().decode('utf-8', errors='ignore'))
