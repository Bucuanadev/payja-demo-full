#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function httpFetch(url, opts = {}) {
  const fetch = global.fetch || require('node-fetch');
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: res.status, body };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/automate-full-sync.cjs <localstorage.json> [--sim http://localhost:3001] [--backend http://localhost:3000]');
    process.exit(2);
  }
  const file = path.resolve(process.cwd(), args[0]);
  let sim = 'http://localhost:3001';
  let backend = 'http://localhost:3000';
  const simIdx = args.indexOf('--sim'); if (simIdx !== -1 && args[simIdx+1]) sim = args[simIdx+1];
  const beIdx = args.indexOf('--backend'); if (beIdx !== -1 && args[beIdx+1]) backend = args[beIdx+1];

  if (!fs.existsSync(file)) { console.error('File not found:', file); process.exit(1); }
  const raw = fs.readFileSync(file, 'utf8');
  let obj; try { obj = JSON.parse(raw); } catch (e) { console.error('Invalid JSON:', e.message); process.exit(1); }
  const customers = Array.isArray(obj) ? obj : (Array.isArray(obj.customers) ? obj.customers : (Array.isArray(obj.data) ? obj.data : []));
  if (!customers.length) { console.log('No customers in input'); process.exit(0); }

  console.log(`1) Posting ${customers.length} customers to simulator ${sim}/api/customers/sync-from-localStorage`);
  try {
    const endpoint = `${sim.replace(/\/$/, '')}/api/customers/sync-from-localStorage`;
    const res = await httpFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customers }) });
    console.log(' -> status', res.status);
    console.log(' -> body', res.body);
  } catch (e) {
    console.warn(' -> simulator sync endpoint failed:', e.message || e);
    console.log(' -> Falling back to direct DB import script');
    try {
      execSync(`node scripts/import-localstorage-to-db.cjs ${file}`, { stdio: 'inherit' });
    } catch (ex) {
      console.error('Fallback import script failed:', ex.message || ex);
    }
  }

  console.log('2) Posting simulator config to persist (optional)');
  try {
    const cfgEndpoint = `${sim.replace(/\/$/, '')}/api/simulator-config`;
    const res = await httpFetch(cfgEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customers }) });
    console.log(' -> status', res.status);
    console.log(' -> body', res.body);
  } catch (e) {
    console.warn(' -> simulator config persist failed:', e.message || e);
  }

  console.log('3) Calling simulator import-persisted to ensure DB has persisted customers');
  try {
    const imp = `${sim.replace(/\/$/, '')}/api/customers/import-persisted`;
    const res = await httpFetch(imp, { method: 'POST' });
    console.log(' -> status', res.status);
    console.log(' -> body', res.body);
  } catch (e) {
    console.warn(' -> import-persisted failed:', e.message || e);
  }

  console.log('4) Triggering PayJA backend sync at', `${backend.replace(/\/$/, '')}/api/v1/integrations/ussd/sync-new-customers`);
  try {
    const endpoint = `${backend.replace(/\/$/, '')}/api/v1/integrations/ussd/sync-new-customers`;
    const res = await httpFetch(endpoint, { method: 'POST' });
    console.log(' -> status', res.status);
    console.log(' -> body', res.body);
  } catch (e) {
    console.warn(' -> backend sync failed:', e.message || e);
  }

  // Retry logic: if some phones are still not verified, attempt to reset synced flag in simulator and retry sync
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\nRetry attempt ${attempt} - checking backend status for customers`);
    const notVerified = [];
    for (const c of customers) {
      const phone = String(c.phoneNumber || c.msisdn || c.phone || '').trim();
      if (!phone) continue;
      try {
        const url = `${backend.replace(/\/$/, '')}/api/v1/integrations/ussd/customer-status/${encodeURIComponent(phone)}`;
        const r = await httpFetch(url, { method: 'GET' });
        const body = r.body;
        if (!body || !body.success || body.verified !== true) {
          notVerified.push(phone);
        }
      } catch (e) {
        notVerified.push(phone);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (notVerified.length === 0) {
      console.log('All customers verified or no action needed.');
      break;
    }

    console.log('Customers not verified:', notVerified);
    // For each not verified, set synced flag to 0 so simulator will expose them again, then re-run backend sync
    for (const phone of notVerified) {
      try {
        console.log('Resetting synced flag for', phone);
        execSync(`node scripts/set-synced-flag.cjs ${phone} 0`, { stdio: 'inherit' });
      } catch (e) {
        console.warn('Could not reset synced flag for', phone, e.message || e);
      }
    }

    console.log('Triggering backend sync again');
    try {
      const endpoint2 = `${backend.replace(/\/$/, '')}/api/v1/integrations/ussd/sync-new-customers`;
      const res2 = await httpFetch(endpoint2, { method: 'POST' });
      console.log(' -> status', res2.status);
      console.log(' -> body', res2.body);
    } catch (e) {
      console.warn(' -> backend sync failed on retry:', e.message || e);
    }

    // wait a bit before next retry
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }

  // Poll status for each phone
  console.log('5) Polling backend customer status for each phone (2s interval)');
  for (const c of customers) {
    const phone = String(c.phoneNumber || c.msisdn || c.phone || '').trim();
    if (!phone) continue;
    try {
      const url = `${backend.replace(/\/$/, '')}/api/v1/integrations/ussd/customer-status/${encodeURIComponent(phone)}`;
      const r = await httpFetch(url, { method: 'GET' });
      console.log(` -> ${phone} status:`, r.body);
      // If backend reports this phone as verified, inform the simulator so it can mark and send SMS
      try {
        const body = r.body || {};
        if (body && (body.verified === true || (body.success === true && body.verified))) {
          console.log(` -> Notifying simulator that ${phone} is verified`);
          try {
            const markUrl = `${sim.replace(/\/$/, '')}/api/payja/ussd/mark-verified`;
            await httpFetch(markUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: phone }) });
          } catch (e) {
            console.warn(' -> Failed to call mark-verified on simulator for', phone, e && e.message ? e.message : e);
          }
          if (body && typeof body.creditLimit !== 'undefined') {
            try {
              const eligUrl = `${sim.replace(/\/$/, '')}/api/payja/ussd/eligibility`;
              await httpFetch(eligUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: phone, creditLimit: body.creditLimit }) });
            } catch (e) {
              console.warn(' -> Failed to call eligibility on simulator for', phone, e && e.message ? e.message : e);
            }
          }
        }
      } catch (notifyErr) {
        console.warn(' -> Error while notifying simulator for', phone, notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
      }
    } catch (e) {
      console.log(` -> ${phone} status request failed:`, e.message || e);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // Fetch simulator SMS logs
  console.log('6) Fetching simulator SMS logs');
  try {
    const smsUrl = `${sim.replace(/\/$/, '')}/api/sms/logs`;
    const r = await httpFetch(smsUrl, { method: 'GET' });
    console.log(' -> sms logs:', r.body);
  } catch (e) {
    console.warn(' -> failed to fetch sms logs:', e.message || e);
  }

  console.log('\nAutomation finished');
}

main().catch(e => { console.error(e && e.message ? e.message : e); process.exit(1); });
