const fs = require('fs');
const path = '/root/payja-demo-full/banco-mock/backend/banco.json';

try {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  
  data.clientes.forEach(cliente => {
    cliente.status_conta = 'ATIVA';
    // Garantir que o BI está válido para evitar rejeições por BI
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 5);
    cliente.bi_validade = futureDate.toISOString();
  });

  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Sucesso: Todas as contas foram ativadas e BIs validados no Banco Mock.');
} catch (error) {
  console.error('Erro ao ativar contas:', error.message);
  process.exit(1);
}
