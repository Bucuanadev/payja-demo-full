const fs = require('fs');
const path = '/root/payja-demo-full/banco-mock/backend/banco.json';

try {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  
  // Mapear telefones para garantir que são únicos
  const seenPhones = new Set();
  
  data.clientes.forEach((cliente, index) => {
    if (seenPhones.has(cliente.telefone)) {
      // Se o telefone já existe, gerar um novo baseado no NUIT para ser único
      const originalPhone = cliente.telefone;
      cliente.telefone = "258" + cliente.nuit.substring(0, 9);
      console.log(`Corrigido telefone duplicado para ${cliente.nome_completo}: ${originalPhone} -> ${cliente.telefone}`);
    }
    seenPhones.add(cliente.telefone);
  });

  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Sucesso: Todos os telefones são agora únicos no Banco Mock.');
} catch (error) {
  console.error('Erro ao corrigir telefones:', error.message);
  process.exit(1);
}
