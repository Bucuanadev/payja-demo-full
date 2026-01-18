const path = require('path');
module.exports = {
  apps: [
    {
      name: 'banco-mock-backend',
      cwd: path.join(__dirname, 'banco-mock', 'backend'),
      script: 'src/index.js',
      env: {
        NODE_ENV: 'development',
        PORT: 4500,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
