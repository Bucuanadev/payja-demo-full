module.exports = {
  apps: [
    {
      name: 'ussd-simulator',
      cwd: '/root/payja-demo/ussd-simulator-standalone',
      script: 'src/main.cjs',
      env: {
        PORT: 3001,
        NODE_ENV: 'development'
      }
    }
  ]
};
