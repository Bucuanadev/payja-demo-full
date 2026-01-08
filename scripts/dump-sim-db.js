const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const candidates = [
  path.join(__dirname, '..', 'ussd-simulator-standalone', 'data', 'ussd_simulator.db'),
  path.join(__dirname, '..', 'ussd-simulator-standalone', 'data', 'ussd.db'),
  path.join(__dirname, '..', 'ussd-simulator-standalone', 'data', 'ussd-react.db'),
];

(async function() {
  for (const p of candidates) {
    try {
      const d = new sqlite3.Database(p, sqlite3.OPEN_READONLY);
      await new Promise((resolve, reject) => {
        d.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
          if (err) { console.log('\nDB:', p, ' - open error:', err.message); d.close(); return resolve(); }
          console.log('\nDB:', p, 'tables:', JSON.stringify(tables));
          d.all('SELECT * FROM customers LIMIT 200', (err2, rows) => {
            if (err2) { console.log('  NO customers table or query error:', err2.message); d.close(); return resolve(); }
            console.log('  CUSTOMERS:', JSON.stringify(rows || [], null, 2));
            d.all('SELECT * FROM sync_logs ORDER BY sync_date DESC LIMIT 50', (err3, logs) => {
              if (err3) { console.log('  NO sync_logs or query error:', err3.message); d.close(); return resolve(); }
              console.log('  SYNC_LOGS:', JSON.stringify(logs || [], null, 2));
              d.close();
              return resolve();
            });
          });
        });
      });
    } catch (e) {
      console.log('\nDB:', p, ' - cannot open:', String(e.message || e));
    }
  }
  process.exit(0);
})();
