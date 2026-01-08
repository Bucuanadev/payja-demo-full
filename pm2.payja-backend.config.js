const path = require('path');
module.exports = {
  apps: [
    {
      name: 'payja-backend',
      cwd: path.join(__dirname, 'backend'),
      script: 'dist/src/main.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        USSD_SIM_BASE_URL: 'http://155.138.228.89:3001',
        USSD_SIMULATOR_URL: 'http://155.138.228.89:3001',
        USSD_API_ENDPOINT: '/api/payja/ussd/new-customers',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
