module.exports = {
  apps: [
    {
      name: 'reputation-worker',
      cwd: '/opt/reputation-os',
      script: 'pnpm',
      args: '--filter worker dev',
      env: {
        NODE_ENV: 'development'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
}
