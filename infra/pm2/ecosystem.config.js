module.exports = {
  apps: [
    {
      name: 'reputation-api',
      cwd: '/opt/reputation-os/apps/api',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4010,
        REDIS_URL: 'redis://127.0.0.1:6380'
      }
    },
    {
      name: 'reputation-worker',
      cwd: '/opt/reputation-os/apps/worker',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        REDIS_URL: 'redis://127.0.0.1:6380'
      }
    },
    {
      name: 'reputation-frontend',
      cwd: '/opt/reputation-os/apps/frontend',
      script: '.next/standalone/apps/frontend/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4011,
        HOSTNAME: '0.0.0.0'
      }
    },
    {
      name: 'reputation-landing',
      cwd: '/opt/reputation-os/apps/landing',
      script: '.next/standalone/apps/landing/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4012,
        HOSTNAME: '0.0.0.0'
      }
    }
  ]
}
