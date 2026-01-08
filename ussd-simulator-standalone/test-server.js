#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`Keep running... Ctrl+C to stop`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✅ Shutdown gracefully');
  process.exit(0);
});
