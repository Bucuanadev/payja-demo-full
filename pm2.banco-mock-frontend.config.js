module.exports = {
  apps: [
    {
      name: 'banco-mock-frontend',
      cwd: '/root/payja-demo/banco-mock/frontend',
      script: 'npm',
      args: 'run dev -- --port 4100 --host',
      env: {
        PORT: 4100
      }
    }
  ]
};
