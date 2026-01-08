module.exports = {
  apps: [
    {
      name: "banco-mock-frontend",
      cwd: __dirname,
      script: "cmd",
      args: "/c npm run dev",
      env: {
        NODE_ENV: "development"
      },
      exec_interpreter: "none",
      exec_mode: "fork"
    }
  ]
};
