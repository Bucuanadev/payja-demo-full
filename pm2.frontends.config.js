module.exports = {
  apps: [
    {
      name: 'banco-mock-frontend',
      cwd: 'C:/Users/User/Downloads/ussd/payja-demo/banco-mock/frontend',
      script: 'cmd',
      interpreter: 'none',
      args: '/c npm run dev -- --host 0.0.0.0 --port 4100',
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'payja-desktop',
      cwd: 'C:/Users/User/Downloads/ussd/payja-demo/desktop',
      script: 'cmd',
      interpreter: 'none',
      args: '/c npm run dev -- --host 0.0.0.0 --port 5173',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
