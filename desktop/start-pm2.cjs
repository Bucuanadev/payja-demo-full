const { spawn } = require('child_process');

const child = spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('close', (code) => {
  console.log(`vite exited with code ${code}`);
});
