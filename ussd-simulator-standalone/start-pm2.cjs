module.exports = {
  apps: [
    {
      name: 'ussd-simulator',
      script: './src/main.js',
      cwd: __dirname,
      watch: ['src', 'public'],
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
