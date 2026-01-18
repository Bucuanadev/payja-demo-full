const path = require('path');

module.exports = {
  apps: [
    {
      name: 'ussd-simulator',
      cwd: path.join(__dirname, 'ussd-simulator-standalone'),
      script: 'src/main.js',
      env: {
        PORT: 3001,
        NODE_ENV: 'development'
      },
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
    }
  ]
};
