module.exports = {
  apps: [
    {
      name: 'ussd-simulator',
      cwd: 'C:/Users/User/Downloads/ussd/ussd-simulator-standalone',
      script: 'src/main.js',
      env: {
        PORT: 3001,
        NODE_ENV: 'development'
      }
    }
  ]
};
