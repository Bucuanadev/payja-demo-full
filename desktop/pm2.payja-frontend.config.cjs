module.exports = {
  apps: [
    {
      name: "payja-frontend",
      cwd: __dirname,
      script: "cmd",
      args: "/c npm run dev",
      env: {
        NODE_ENV: "development"
      },
      exec_mode: "fork"
    }
  ]
};
