module.exports = {
  apps: [
    {
      name: 'banco-mock-frontend',
      cwd: 'C:/Users/User/Downloads/ussd/payja-demo/banco-mock/frontend',
      script: 'cmd.exe',
      args: '/c start-frontend.bat',
      interpreter: 'none',
      env: {
        PORT: 4100
      }
    }
  ]
};
