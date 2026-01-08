#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/import-localstorage-to-server.cjs <localstorage.json> [--url http://localhost:3002]');
    process.exit(2);
  }

  const file = path.resolve(process.cwd(), args[0]);
  let url = 'http://localhost:3002';
  const urlArgIndex = args.findIndex(a => a === '--url');
  if (urlArgIndex !== -1 && args[urlArgIndex + 1]) url = args[urlArgIndex + 1];

  if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
  }

  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { console.error('Read error:', e.message); process.exit(1); }
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { console.error('Invalid JSON:', e.message); process.exit(1); }

  // Accept either { customers: [...] } or an array
  let customers = [];
  if (Array.isArray(obj)) customers = obj;
  else if (Array.isArray(obj.customers)) customers = obj.customers;
  else if (obj && typeof obj === 'object' && Array.isArray(obj.data)) customers = obj.data;
  else {
    console.error('Input JSON must be an array or have a top-level `customers` array');
    process.exit(1);
  }

  if (customers.length === 0) {
    console.log('No customers to import.');
    process.exit(0);
  }

  const endpoint = `${url.replace(/\/$/, '')}/api/customers/sync-from-localStorage`;
  console.log(`Posting ${customers.length} customer(s) to ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customers })
    });
    const text = await res.text();
    console.log('Response status:', res.status);
    try { console.log('Body:', JSON.parse(text)); } catch (e) { console.log('Body:', text); }
  } catch (e) {
    console.error('Request failed:', e.message || e);
    process.exit(1);
  }
}

main();
