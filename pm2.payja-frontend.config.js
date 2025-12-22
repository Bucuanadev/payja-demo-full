module.exports = {
  apps: [
    {
      name: 'payja-frontend',
      cwd: 'C:/Users/User/Downloads/ussd/payja-demo/desktop',
      script: 'cmd.exe',
      args: '/c start-frontend.bat',
      interpreter: 'none',
      env: {
        PORT: 5173
      }
    }
  ]
};
