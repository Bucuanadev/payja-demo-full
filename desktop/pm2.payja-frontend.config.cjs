// Arquivo convertido para CommonJS para uso com PM2
module.exports = {
  apps: [
    {
      name: "payja-frontend",
      cwd: __dirname,
      script: "cmd.exe",
      args: "/c npm run dev",
      env: {
        NODE_ENV: "development"
      },
      interpreter: "none",
      exec_mode: "fork"
    }
  ]
};
