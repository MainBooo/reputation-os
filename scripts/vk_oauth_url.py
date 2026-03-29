import os, urllib.parse

params = {
    'client_id': os.environ['VK_APP_ID'],
    'redirect_uri': os.environ['VK_REDIRECT_URI'],
    'response_type': 'code',
    'scope': os.environ.get('VK_SCOPE', 'wall,offline'),
    'display': 'page',
    'prompt': 'login',
    'v': os.environ.get('VK_API_VERSION', '5.131'),
}
print('https://oauth.vk.com/authorize?' + urllib.parse.urlencode(params))
