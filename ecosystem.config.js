module.exports = {
  apps: [{
    name: 'libi-api',
    script: './dist/index.js',
    cwd: '/var/www/libi/api',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/libi-api-error.log',
    out_file: '/var/log/pm2/libi-api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M'
  }]
}