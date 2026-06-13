module.exports = {
  apps: [
    {
      name: 'renda-viva-api',
      script: '/root/renda-viva-src/apps/api/dist/app.js',
      cwd: '/root/renda-viva-src/apps/api',
      env_file: '/root/renda-viva-src/apps/api/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'renda-viva-web',
      script: '/root/renda-viva-src/apps/web/.next/standalone/apps/web/server.js',
      cwd: '/root/renda-viva-src/apps/web/.next/standalone/apps/web',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
}
