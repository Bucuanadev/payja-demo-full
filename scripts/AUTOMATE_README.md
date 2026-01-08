Automate Full Sync Script

Usage:

node automate-full-sync.cjs <localstorage.json> [--sim http://localhost:3001] [--backend http://localhost:3000]

What it does:
1) Posts localStorage JSON to simulator `/api/customers/sync-from-localStorage` (falls back to direct DB import if endpoint unreachable).
2) Persists simulator config via `/api/simulator-config`.
3) Calls `/api/customers/import-persisted` on simulator to ensure DB contains persisted customers.
4) Triggers backend sync at `/api/v1/integrations/ussd/sync-new-customers`.
5) Polls backend `/customer-status/:phoneNumber` for each phone and retries up to 3 times: for unverified phones, it resets `synced_with_payja=0` in simulator DB (using `scripts/set-synced-flag.cjs`) and re-triggers backend sync.
6) Fetches simulator SMS logs at `/api/sms/logs`.

Notes:
- Ensure the simulator is running at the `--sim` URL (default http://localhost:3001).
- Ensure the backend is running at the `--backend` URL (default http://localhost:3000).
- To forward SMS to a real gateway, set the environment variable `SMS_GATEWAY_URL` in the simulator process; the simulator will POST `{ to, message }` to that URL when sending SMS.
