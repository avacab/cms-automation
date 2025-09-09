module.exports = {
  apps: [
    {
      name: 'ai-writing-assistant',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5002
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5002,
        instances: 2,
        exec_mode: 'cluster'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/ai-assistant-error.log',
      out_file: './logs/ai-assistant-out.log',
      log_file: './logs/ai-assistant-combined.log',
      time: true
    }
  ]
};