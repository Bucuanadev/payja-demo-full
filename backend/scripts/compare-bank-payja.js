const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function run() {
  try {
    const payja = await prisma.customer.findMany({ where: {}, take: 50 });
    const bankResp = await fetch('http://155.138.228.89:4500/api/clientes');
    const bankJson = await bankResp.json();
    const clientes = bankJson.clientes || [];

    for (const p of payja) {
      const found = clientes.find(b => b.nuit && p.nuit && String(b.nuit).trim() === String(p.nuit).trim());
      console.log(`PayJA ${p.phoneNumber} nuit=${p.nuit} -> bank match: ${found ? found.nome_completo : 'NO'}`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
