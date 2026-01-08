const PayJACompatibleSimulator = require('./payja-compatible-simulator.cjs');

// Inicializar o simulador
const simulator = new PayJACompatibleSimulator();
simulator.start();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Encerrando simulador compatível com PayJA...');
    try { await simulator.db.close(); } catch (e) {}
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🔚 Terminando simulador...');
    try { await simulator.db.close(); } catch (e) {}
    process.exit(0);
});
