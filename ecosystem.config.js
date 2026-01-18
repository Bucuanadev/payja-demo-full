const path = require('path');

module.exports = {
  apps: [
    // PayJA Backend (NestJS built output)
    {
      name: 'payja-backend',
      cwd: path.join(__dirname, 'backend'),
      script: 'node',
      args: 'dist/src/main.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // Banco Mock Backend (Express)
    {
      name: 'banco-mock-backend',
      cwd: path.join(__dirname, 'banco-mock', 'backend'),
      script: 'node',
      args: 'src/index.js',
      env: {
        NODE_ENV: 'development',
        PORT: 4500,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // Banco Mock Frontend (Vite)
    {
      name: 'banco-mock-frontend',
      cwd: path.join(__dirname, 'banco-mock', 'frontend'),
      script: process.platform === 'win32' ? 'cmd' : 'bash',
      args: process.platform === 'win32'
        ? '/c npm run dev -- --host 0.0.0.0 --port 4100'
        : '-lc "npm run dev -- --host 0.0.0.0 --port 4100"',
      env: {
        NODE_ENV: 'development',
      },
      autorestart: true,
      restart_delay: 3000,
    },

    // PayJA Desktop (Vite)
    {
      name: 'payja-desktop',
      cwd: path.join(__dirname, 'desktop'),
      script: process.platform === 'win32' ? 'cmd' : 'bash',
      args: process.platform === 'win32'
        ? '/c npm run dev -- --host 0.0.0.0 --port 5173'
        : '-lc "npm run dev -- --host 0.0.0.0 --port 5173"',
      env: {
        NODE_ENV: 'development',
      },
      autorestart: true,
      restart_delay: 3000,
    },

    // USSD Simulator (Express)
    {
      name: 'ussd-simulator',
      cwd: path.join(__dirname, 'ussd-simulator-standalone'),
      script: 'src/main.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
    },
  ],
};
