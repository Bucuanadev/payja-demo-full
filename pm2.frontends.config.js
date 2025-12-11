module.exports = {
  apps: [
    {
      name: 'banco-mock-frontend',
      cwd: './banco-mock/frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 4100',
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'payja-desktop',
      cwd: './desktop',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5173',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
