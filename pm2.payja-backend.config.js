const path = require('path');

module.exports = {
  apps: [
    {
      name: 'payja-backend',
      cwd: path.join(__dirname, 'backend'),
      script: 'node',
      args: 'dist/src/main.js',
      interpreter: process.platform === 'win32' ? undefined : 'node',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
