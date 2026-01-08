#!/usr/bin/env node
const { execSync } = require('child_process');
try {
  const out = execSync('netstat -ano | findstr :3000', { encoding: 'utf8' });
  const lines = out.trim().split(/\r?\n/).filter(Boolean);
  const pids = new Set();
  for (const l of lines) {
    const parts = l.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid) pids.add(pid);
  }
  if (pids.size === 0) {
    console.log('No process found on port 3000');
  } else {
    for (const pid of pids) {
      console.log('Killing', pid);
      try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' }); } catch (e) { console.error('Failed to kill', pid, e.message); }
    }
  }
} catch (e) {
  // findstr exits with code 1 if no matches
  if (e.status === 1) {
    console.log('No process found on port 3000');
  } else {
    console.error('Error running netstat:', e && e.message ? e.message : e);
    process.exit(2);
  }
}
