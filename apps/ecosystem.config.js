module.exports = {
  apps: [
    {
      name: 'renda-viva-api',
      script: '/root/renda-viva/api/dist/app.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/root/.pm2/logs/renda-viva-api-error.log',
      out_file: '/root/.pm2/logs/renda-viva-api-out.log'
    },
    {
      name: 'renda-viva-web',
      script: '/root/renda-viva/web/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/root/.pm2/logs/renda-viva-web-error.log',
      out_file: '/root/.pm2/logs/renda-viva-web-out.log'
    }
  ]
}