module.exports = {
  apps: [
    {
      name: 'reputation-api',
      cwd: '/opt/reputation-os/apps/api',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'reputation-frontend',
      cwd: '/opt/reputation-os/apps/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'reputation-worker',
      cwd: '/opt/reputation-os/apps/worker',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
