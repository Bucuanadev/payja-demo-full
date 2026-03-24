const fs = require('fs');
const path = '/root/payja-demo-full/banco-mock/backend/banco.json';

try {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const seenNuits = new Set();
  const uniqueClientes = [];

  // Filtrar apenas clientes únicos pelo NUIT
  data.clientes.forEach(cliente => {
    if (!seenNuits.has(cliente.nuit)) {
      seenNuits.add(cliente.nuit);
      uniqueClientes.push(cliente);
    }
  });

  data.clientes = uniqueClientes;
  
  // Limpar também as decisões anteriores do PayJA para forçar reavaliação limpa
  data.payja_decisions = []; 

  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`Sucesso: ${uniqueClientes.length} clientes únicos mantidos.`);
} catch (error) {
  console.error('Erro ao limpar banco.json:', error.message);
  process.exit(1);
}
