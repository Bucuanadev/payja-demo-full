// Script para remover duplicatas de NUIT do simulator-customers.json
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../simulator-customers.json');
const OUTPUT_PATH = path.join(__dirname, '../simulator-customers-dedup.json');

function dedupByNuit() {
    if (!fs.existsSync(JSON_PATH)) {
        console.error('Arquivo simulator-customers.json não encontrado.');
        return;
    }
    const raw = fs.readFileSync(JSON_PATH, 'utf-8');
    const customers = JSON.parse(raw);
    const seen = new Set();
    const deduped = customers.filter(c => {
        const nuit = c.nuit || c.registrationData?.nuit;
        if (!nuit) return false;
        if (seen.has(nuit)) return false;
        seen.add(nuit);
        return true;
    });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(deduped, null, 2));
    console.log(`Arquivo deduplicado salvo como simulator-customers-dedup.json (${deduped.length} clientes).`);
}

dedupByNuit();
