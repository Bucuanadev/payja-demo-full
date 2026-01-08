module.exports = {
  apps: [
    {
      name: 'payja-frontend',
      cwd: '/root/payja-demo/desktop',
      script: 'npm',
      args: 'run dev -- --port 5173 --host',
      env: {
        PORT: 5173
      }
    }
  ]
};
