const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const cfgPath = path.join(dataDir, 'simulator-config.json');

function loadConfig() {
  try {
    if (!fs.existsSync(cfgPath)) return {};
    const raw = fs.readFileSync(cfgPath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.warn('[ConfigStore] load error:', e && e.message ? e.message : e);
    return {};
  }
}

function saveConfig(obj) {
  try {
    fs.writeFileSync(cfgPath, JSON.stringify(obj, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[ConfigStore] save error:', e && e.message ? e.message : e);
    return false;
  }
}

module.exports = { loadConfig, saveConfig, cfgPath };
