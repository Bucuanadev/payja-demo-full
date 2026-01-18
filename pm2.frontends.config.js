const path = require('path');
module.exports = {
  apps: [
    {
      name: 'banco-mock-frontend',
      cwd: path.join(__dirname, 'banco-mock', 'frontend'),
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 4100',
      env: {
        NODE_ENV: 'development',
      },
      autorestart: true,
      restart_delay: 3000,
    },
    {
      name: 'payja-desktop',
      cwd: path.join(__dirname, 'desktop'),
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5173',
      env: {
        NODE_ENV: 'development',
      },
      autorestart: true,
      restart_delay: 3000,
    },
  ],
};
