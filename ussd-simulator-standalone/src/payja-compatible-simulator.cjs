const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const Database = require('./database.cjs');

class PayJACompatibleSimulator {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.db = new Database();
        this.smsLogs = [];
        this.setupMiddleware();
        this.setupPayJAEndpoints();
        this.setupUSSDEndpoints();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
        // Serve simulator frontend static files from ../public if present
        try {
            const publicDir = path.join(__dirname, '..', 'public');
            if (fs.existsSync(publicDir)) {
                this.app.use(express.static(publicDir));
            }
        } catch (e) {}
        this.app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
            next();
        });
    }

    setupPayJAEndpoints() {
        this.app.get('/api/payja/ussd/new-customers', async (req, res) => {
            try {
                const customers = await this.db.getUnsyncedCustomers();
                const formattedCustomers = customers.map(customer => ({
                    phoneNumber: customer.msisdn,
                    name: customer.name || 'Cliente USSD',
                    nuit: this.generateRandomNuit(),
                    biNumber: this.generateRandomBI(),
                    institution: this.getRandomInstitution(),
                    registeredAt: customer.created_at || new Date().toISOString()
                }));
                console.log(`[PayJA Compatible] Returning ${formattedCustomers.length} customers in PayJA format`);
                res.json(formattedCustomers);
            } catch (error) {
                console.error('Error fetching new customers for PayJA:', error);
                res.status(500).json({ error: 'Failed to fetch new customers', details: error.message });
            }
        });

        this.app.post('/api/payja/ussd/mark-verified', async (req, res) => {
            try {
                const { phoneNumber, creditLimit, name, nuit, biNumber, email, salary, salaryBank, creditScore } = req.body;
                if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
                // Mark synced and verified in local DB (try several phone columns)
                try {
                    const updateSql = `UPDATE customers SET synced_with_payja = 1, verified = 1, status = 'verified', phoneNumber = COALESCE(phoneNumber, ?), name = COALESCE(name, ?), nuit = COALESCE(nuit, ?), biNumber = COALESCE(biNumber, ?) WHERE msisdn = ? OR phoneNumber = ? OR phone = ?`;
                    const params = [phoneNumber, name || null, nuit || null, biNumber || null, phoneNumber, phoneNumber, phoneNumber];
                    const r = await this.db.run(updateSql, params);
                    await this.db.addSyncLog(phoneNumber, 'VERIFIED_BY_PAYJA', `Credit Limit: ${creditLimit}, Bank: ${salaryBank}, Score: ${creditScore}`);
                    console.log(`[PayJA Compatible] mark-verified update changes=${r.changes} phone=${phoneNumber}`);
                } catch (e) {
                    console.warn('[PayJA Compatible] mark-verified DB update failed:', e && e.message ? e.message : e);
                }

                // Record SMS mock and try to notify smartphone via simulator UI
                try {
                    this.sendConfirmationSms(phoneNumber, name || '', creditLimit || 0);
                } catch (e) {
                    console.warn('[PayJA Compatible] sendConfirmationSms failed:', e && e.message ? e.message : e);
                }

                res.json({ success: true, message: `Customer ${phoneNumber} successfully verified`, timestamp: new Date().toISOString() });
            } catch (error) {
                console.error('Error marking customer as verified:', error);
                res.status(500).json({ error: 'Failed to mark customer as verified', details: error.message });
            }
        });

        this.app.post('/api/payja/ussd/eligibility', async (req, res) => {
            try {
                const { phoneNumber, eligible, creditLimit, minAmount, reason } = req.body;
                console.log(`[PayJA Compatible] Eligibility check: ${phoneNumber} - ${eligible ? 'Eligible' : 'Not Eligible'}`);
                await this.db.addSyncLog(phoneNumber, 'ELIGIBILITY_CHECK', `Eligible: ${eligible}, Limit: ${creditLimit}, Reason: ${reason}`);
                // Send eligibility SMS to the phone (inform user of verification and limit)
                try {
                    this.sendEligibilitySms(phoneNumber, eligible, creditLimit, reason);
                } catch (e) {
                    console.warn('[PayJA Compatible] sendEligibilitySms failed:', e && e.message ? e.message : e);
                }

                res.json({ success: true, message: `Eligibility recorded for ${phoneNumber}`, phoneNumber, eligible, creditLimit, timestamp: new Date().toISOString() });
            } catch (error) {
                console.error('Error processing eligibility:', error);
                res.status(500).json({ error: 'Failed to process eligibility', details: error.message });
            }
        });

        this.app.get('/api/loans', async (req, res) => {
            try {
                const customers = await this.db.getVerifiedCustomers();
                const loans = customers.slice(0, 5).map((customer, index) => ({
                    id: `loan_${Date.now()}_${index}`,
                    phoneNumber: customer.msisdn,
                    customerName: customer.name,
                    amount: Math.floor(Math.random() * 50000) + 1000,
                    term: '30 dias',
                    interest: 15 + Math.random() * 5,
                    status: index % 3 === 0 ? 'PENDING' : index % 3 === 1 ? 'APPROVED' : 'DISBURSED',
                    reason: ['Educação', 'Saúde', 'Negócio', 'Emergência'][index % 4],
                    bank: ['Banco BIM', 'Banco BCI', 'Standard Bank'][index % 3],
                    score: 600 + Math.floor(Math.random() * 200),
                    createdAt: new Date(Date.now() - index * 86400000).toISOString(),
                    updatedAt: new Date().toISOString()
                }));
                console.log(`[PayJA Compatible] Returning ${loans.length} mock loans`);
                res.json(loans);
            } catch (error) {
                console.error('Error fetching loans:', error);
                res.status(500).json({ error: 'Failed to fetch loans', details: error.message });
            }
        });

        // SMS mock endpoints
        this.app.get('/api/sms/logs', (req, res) => {
            try {
                const phone = req.query.phone || null;
                if (phone) return res.json({ count: this.smsLogs.filter(s => s.phoneNumber === String(phone)).length, data: this.smsLogs.filter(s => s.phoneNumber === String(phone)) });
                return res.json({ count: this.smsLogs.length, data: this.smsLogs.slice(-200) });
            } catch (e) {
                return res.status(500).json({ error: e && e.message ? e.message : String(e) });
            }
        });

        this.app.post('/api/sms/send', (req, res) => {
            try {
                const { phoneNumber, message } = req.body || {};
                if (!phoneNumber || !message) return res.status(400).json({ error: 'phoneNumber and message are required' });
                this.sendConfirmationSms(phoneNumber, message, 0, true);
                return res.json({ success: true, message: 'sms queued' });
            } catch (e) {
                return res.status(500).json({ error: e && e.message ? e.message : String(e) });
            }
        });

        this.app.patch('/api/loans/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status, disbursedAt } = req.body;
                console.log(`[PayJA Compatible] Updating loan ${id} to status: ${status}`);
                res.json({ success: true, message: `Loan ${id} status updated to ${status}`, loanId: id, status, updatedAt: new Date().toISOString() });
            } catch (error) {
                console.error('Error updating loan status:', error);
                res.status(500).json({ error: 'Failed to update loan status', details: error.message });
            }
        });

        this.app.get('/api/payja/health', (req, res) => {
            res.json({ service: 'payja-ussd-simulator', status: 'operational', version: '2.0', timestamp: new Date().toISOString(), endpoints: { new_customers: '/api/payja/ussd/new-customers', mark_verified: '/api/payja/ussd/mark-verified', eligibility: '/api/payja/ussd/eligibility', loans: '/api/loans' } });
        });
    }

    setupUSSDEndpoints() {
        this.app.get('/health', (req, res) => {
            res.json({ status: 'OK', simulator: 'payja-compatible', timestamp: new Date().toISOString() });
        });

        this.app.get('/api/customers/unsynced', async (req, res) => {
            try {
                const customers = await this.db.getUnsyncedCustomers();
                res.json(customers.map(c => ({ msisdn: c.msisdn, name: c.name, created_at: c.created_at })));
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/customers', async (req, res) => {
            try {
                const includeSynced = req.query.include_synced === 'true';
                const customers = await this.db.getAllCustomers(includeSynced);
                res.json(customers);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Accept registrations pushed from the frontend (customers.html) outbox/localStorage
        this.app.post('/api/customers/register', async (req, res) => {
            try {
                const payload = req.body || {};
                try { console.log('[Register] incoming payload:', JSON.stringify(payload)); } catch (e) {}

                const phone = (payload.phoneNumber || payload.msisdn || payload.phone || '').toString().trim();
                if (!phone) return res.status(400).json({ error: 'phoneNumber is required' });

                const name = (payload.name || payload.fullName || '').trim();
                const nameParts = name ? name.split(' ') : ['',''];
                const firstName = nameParts.shift() || '';
                const lastName = nameParts.join(' ') || '';
                let nuit = payload.nuit || null;
                const biNumber = payload.biNumber || payload.bi || null;
                const verified = payload.verified ? 1 : 0;
                const isActive = payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : 1;
                const status = payload.status || (verified ? 'verified' : 'registered');

                if (!nuit) {
                    try { const { v4: uuidv4 } = require('uuid'); nuit = `MISSING-${uuidv4()}`; } catch (e) { nuit = `MISSING-${Date.now()}`; }
                }

                const pragma = await this.db.all('PRAGMA table_info(customers)');
                const cols = pragma.map(p => p.name);

                const phoneCols = ['phoneNumber','msisdn','phone'].filter(c => cols.includes(c));
                if (phoneCols.length === 0) return res.status(500).json({ error: 'No phone column found in customers table' });

                // Try to find existing customer by any phone-like column
                const wherePhone = phoneCols.map(c => `${c} = ?`).join(' OR ');
                const existing = await this.db.get(`SELECT * FROM customers WHERE ${wherePhone} LIMIT 1`, phoneCols.map(() => phone));

                if (existing) {
                    // Update some fields on existing
                    const updates = [];
                    const params = [];
                    if (cols.includes('name')) { updates.push('name = ?'); params.push(name || existing.name); }
                    if (cols.includes('nuit')) { updates.push('nuit = ?'); params.push(nuit || existing.nuit); }
                    if (cols.includes('biNumber')) { updates.push('biNumber = ?'); params.push(biNumber || existing.biNumber); }
                    if (cols.includes('institution')) { updates.push('institution = ?'); params.push(payload.institution || existing.institution); }
                    if (cols.includes('verified')) { updates.push('verified = ?'); params.push(verified); }
                    if (cols.includes('status')) { updates.push('status = ?'); params.push(status); }
                    if (cols.includes('updatedAt')) { updates.push('updatedAt = ?'); params.push(new Date().toISOString()); }

                    if (updates.length > 0) {
                        const sql = `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`;
                        params.push(existing.id);
                        try { await this.db.run(sql, params); } catch (e) { console.error('[Register] update existing error:', e && e.message ? e.message : e); }
                    }

                    const row = await this.db.get(`SELECT * FROM customers WHERE id = ?`, [existing.id]);
                    return res.status(200).json({ ok: true, customer: row, note: 'updated' });
                }

                // Insert new customer - ensure we include a phone column (prefer phoneNumber)
                const preferredPhoneCol = phoneCols.includes('phoneNumber') ? 'phoneNumber' : phoneCols[0];
                const insertCols = [preferredPhoneCol];
                const insertPlaceholders = ['?'];
                const insertParams = [phone];

                if (cols.includes('name')) { insertCols.push('name'); insertPlaceholders.push('?'); insertParams.push(name || `${firstName} ${lastName}`.trim()); }
                else if (cols.includes('fullName')) { insertCols.push('fullName'); insertPlaceholders.push('?'); insertParams.push(name || `${firstName} ${lastName}`.trim()); }
                else if (cols.includes('firstName') && cols.includes('lastName')) { insertCols.push('firstName'); insertPlaceholders.push('?'); insertParams.push(firstName); insertCols.push('lastName'); insertPlaceholders.push('?'); insertParams.push(lastName); }

                if (cols.includes('nuit')) { insertCols.push('nuit'); insertPlaceholders.push('?'); insertParams.push(nuit); }
                if (cols.includes('biNumber')) { insertCols.push('biNumber'); insertPlaceholders.push('?'); insertParams.push(biNumber || null); }
                if (cols.includes('institution')) { insertCols.push('institution'); insertPlaceholders.push('?'); insertParams.push(payload.institution || null); }
                if (cols.includes('isActive')) { insertCols.push('isActive'); insertPlaceholders.push('?'); insertParams.push(isActive); }
                if (cols.includes('verified')) { insertCols.push('verified'); insertPlaceholders.push('?'); insertParams.push(verified); }
                if (cols.includes('status')) { insertCols.push('status'); insertPlaceholders.push('?'); insertParams.push(status); }
                if (cols.includes('createdAt')) { insertCols.push('createdAt'); insertPlaceholders.push('?'); insertParams.push(payload.createdAt || new Date().toISOString()); }
                if (cols.includes('updatedAt')) { insertCols.push('updatedAt'); insertPlaceholders.push('?'); insertParams.push(new Date().toISOString()); }

                const insertSql = `INSERT INTO customers (${insertCols.join(',')}) VALUES (${insertPlaceholders.join(',')})`;
                try {
                    await this.db.run(insertSql, insertParams);
                } catch (dbErr) {
                    const msg = String(dbErr && dbErr.message ? dbErr.message : dbErr);
                    console.error('[Register] DB insert error:', msg);
                    if (msg.includes('UNIQUE constraint failed') || msg.includes('SQLITE_CONSTRAINT')) {
                        // Someone else inserted concurrently; try to fetch existing now
                        const existing2 = await this.db.get(`SELECT * FROM customers WHERE ${wherePhone} LIMIT 1`, phoneCols.map(() => phone));
                        if (existing2) return res.status(200).json({ ok: true, customer: existing2, note: 'existing' });
                        return res.status(409).json({ error: 'duplicate' });
                    }
                    return res.status(500).json({ error: 'internal error', details: msg });
                }

                // Return inserted row
                const row = await this.db.get(`SELECT * FROM customers WHERE ${preferredPhoneCol} = ? LIMIT 1`, [phone]);
                return res.status(201).json({ ok: true, customer: row });
            } catch (err) {
                console.error('[Register] error:', err && err.message ? err.message : err);
                return res.status(500).json({ error: 'internal error', message: err && err.message });
            }
        });

        this.app.post('/api/customers/:msisdn/sync', async (req, res) => {
            try {
                const { msisdn } = req.params;
                await this.db.markAsSynced(msisdn);
                res.json({ success: true, message: `Customer ${msisdn} synced` });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/db-info', async (req, res) => {
            try {
                const total = await this.db.getTotalCustomersCount();
                const unsynced = await this.db.getUnsyncedCount();
                res.json({ database: 'payja_compatible.db', total_customers: total, unsynced_customers: unsynced, timestamp: new Date().toISOString() });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    // Simple root page to make visiting / informative instead of 404
        setupRoot() {
                this.app.get('/', (req, res) => {
                        const indexPath = path.join(__dirname, '..', 'public', 'index.html');
                        if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
                        const html = `
<!doctype html>
<html>
    <head><meta charset="utf-8"><title>USSD Simulator</title></head>
    <body>
        <h1>USSD Simulator (PayJA compatible)</h1>
        <p>Available endpoints:</p>
        <ul>
            <li><a href="/api/payja/ussd/new-customers">/api/payja/ussd/new-customers</a></li>
            <li><a href="/api/payja/ussd/mark-verified">/api/payja/ussd/mark-verified</a></li>
            <li><a href="/api/payja/ussd/eligibility">/api/payja/ussd/eligibility</a></li>
            <li><a href="/api/loans">/api/loans</a></li>
            <li><a href="/api/customers">/api/customers</a></li>
            <li><a href="/api/customers/unsynced">/api/customers/unsynced</a></li>
            <li><a href="/api/db-info">/api/db-info</a></li>
            <li><a href="/api/payja/health">/api/payja/health</a></li>
        </ul>
        <p>Use the API endpoints for simulator interactions.</p>
    </body>
</html>
                        `;
                        res.setHeader('Content-Type', 'text/html');
                        res.send(html);
                });
        }

    generateRandomNuit() {
        return '1' + Math.floor(Math.random() * 900000000 + 100000000);
    }

    generateRandomBI() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)] + Math.floor(Math.random() * 9000000 + 1000000);
    }

    getRandomInstitution() {
        const institutions = ['Banco BIM', 'Banco BCI', 'Standard Bank', 'Moza Banco', 'Millennium BIM', 'Ecobank', 'UBA Moçambique'];
        return institutions[Math.floor(Math.random() * institutions.length)];
    }

    sendConfirmationSms(phoneNumber, nameOrMessage, creditLimit = 0, isCustom = false) {
        try {
            const timestamp = new Date().toISOString();
            const text = isCustom ? (nameOrMessage || '') : `✓ Registo verificado!\n\nCaro ${nameOrMessage || 'Cliente'}, seu registo foi verificado.\nLimite de empréstimo: ${creditLimit} MZN`;
            this._recentSmsSent = this._recentSmsSent || new Map();
            const RECENT_SMS_TTL = parseInt(process.env.RECENT_SMS_TTL_MS || '86400000', 10);
            const key = String(phoneNumber) + '|confirmation';
            const now = Date.now();
            const last = this._recentSmsSent.get(key);
            // Check persistent DB flag to avoid duplicates across modules/instances
            try {
                this.db.get('SELECT confirmation_notified FROM customers WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]).then(row => {
                    if (row && (row.confirmation_notified === 1 || row.confirmation_notified === '1')) {
                        console.log(`[SMS-PERSIST] (compat) confirmation already recorded for ${phoneNumber}, skipping`);
                        return null;
                    }
                    if (last && (now - last) < RECENT_SMS_TTL) {
                        console.log(`[SMS-DEDUPE] (compat) Skipping duplicate confirmation SMS to ${phoneNumber}`);
                        return null;
                    }
                    const entry = { id: Date.now().toString(), phoneNumber: String(phoneNumber), from: 'PayJA', text, message: text, time: timestamp, sentAt: timestamp, provider: process.env.SMS_PROVIDER_URL || null };
                    this.smsLogs.push(entry);
                    this._recentSmsSent.set(key, now);
                    console.log(`📲 SMS preparado para ${phoneNumber}: ${text}`);
                    // Persist flag (best-effort)
                    this.db.run('ALTER TABLE customers ADD COLUMN confirmation_notified INTEGER DEFAULT 0').catch(()=>{});
                    this.db.run('UPDATE customers SET confirmation_notified = 1 WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]).catch(()=>{});
                    // Optionally write to file if configured
                    try {
                        const SMS_LOG_PATH = process.env.SMS_LOG_PATH || null;
                        if (SMS_LOG_PATH) {
                            const ln = `${timestamp} | ${phoneNumber} | ${text}\n`;
                            fs.appendFileSync(path.resolve(SMS_LOG_PATH), ln);
                        }
                    } catch (e) {
                        // ignore file write errors
                    }
                    return entry;
                }).catch(()=>{});
            } catch(e) {}
            return null;
        } catch (e) {
            console.warn('sendConfirmationSms error:', e && e.message ? e.message : e);
            return null;
        }
    }

    sendEligibilitySms(phoneNumber, eligible, creditLimit = 0, reason = '') {
        try {
            const timestamp = new Date().toISOString();
            let text;
            if (eligible) {
                text = `✓ Parabéns! Seu número foi verificado e você foi considerado elegível.\n\nLimite de empréstimo aprovado: ${creditLimit} MZN.\n${reason || ''}`;
            } else {
                text = `ℹ️ Resultado da elegibilidade: Não elegível.\n\nMotivo: ${reason || 'Não especificado'}`;
            }
            this._recentSmsSent = this._recentSmsSent || new Map();
            const RECENT_SMS_TTL = parseInt(process.env.RECENT_SMS_TTL_MS || '86400000', 10);
            const key = String(phoneNumber) + '|eligibility';
            const now = Date.now();
            const last = this._recentSmsSent.get(key);
            try {
                this.db.get('SELECT eligibility_notified FROM customers WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]).then(row => {
                    if (row && (row.eligibility_notified === 1 || row.eligibility_notified === '1')) {
                        console.log(`[SMS-PERSIST] (compat) eligibility already recorded for ${phoneNumber}, skipping`);
                        return null;
                    }
                    if (last && (now - last) < RECENT_SMS_TTL) {
                        console.log(`[SMS-DEDUPE] (compat) Skipping duplicate eligibility SMS to ${phoneNumber}`);
                        return null;
                    }
                    const entry = { id: Date.now().toString(), phoneNumber: String(phoneNumber), from: 'PayJA', text, message: text, time: timestamp, sentAt: timestamp, provider: process.env.SMS_PROVIDER_URL || null };
                    this.smsLogs.push(entry);
                    this._recentSmsSent.set(key, now);
                    console.log(`📲 Eligibility SMS preparado para ${phoneNumber}: ${text}`);
                    this.db.run('ALTER TABLE customers ADD COLUMN eligibility_notified INTEGER DEFAULT 0').catch(()=>{});
                    this.db.run('UPDATE customers SET eligibility_notified = 1 WHERE phoneNumber = ? OR msisdn = ? OR phone = ?', [phoneNumber, phoneNumber, phoneNumber]).catch(()=>{});
                    try {
                        const SMS_LOG_PATH = process.env.SMS_LOG_PATH || null;
                        if (SMS_LOG_PATH) {
                            const ln = `${timestamp} | ${phoneNumber} | ${text}\n`;
                            fs.appendFileSync(path.resolve(SMS_LOG_PATH), ln);
                        }
                    } catch (e) {}
                    return entry;
                }).catch(()=>{});
            } catch(e) {}
            return null;
        } catch (e) {
            console.warn('sendEligibilitySms error:', e && e.message ? e.message : e);
            return null;
        }
    }

    start() {
        // ensure root handler is registered
        try { this.setupRoot(); } catch (e) {}
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`╔═══════════════════════════════════════════╗`);
            console.log(`║     PAYJA COMPATIBLE USSD SIMULATOR       ║`);
            console.log(`║     Port: ${this.port}                              ║`);
            console.log(`╚═══════════════════════════════════════════╝`);
            console.log(`\n📡 Endpoints compatíveis com PayJA:`);
            console.log(`   GET  /api/payja/ussd/new-customers`);
            console.log(`   POST /api/payja/ussd/mark-verified`);
            console.log(`   POST /api/payja/ussd/eligibility`);
            console.log(`   GET  /api/loans`);
            console.log(`   GET  /api/payja/health`);
            console.log(`\n📡 Endpoints originais do simulador:`);
            console.log(`   GET  /api/customers/unsynced`);
            console.log(`   GET  /api/customers`);
            console.log(`   POST /api/customers/:msisdn/sync`);
            console.log(`\n✅ Simulador pronto para integração com PayJA!`);
            console.log(`🔗 O backend PayJA deve apontar para: http://localhost:${this.port}`);
        });
    }
}

module.exports = PayJACompatibleSimulator;
