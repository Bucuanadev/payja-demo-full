const fs = require('fs');
const path = '/root/payja-demo-full/banco-mock/backend/src/database.js';

try {
    let content = fs.readFileSync(path, 'utf8');
    
    if (content.includes('createCliente:')) {
        console.log('Função createCliente já existe.');
        process.exit(0);
    }

    const insertionPoint = 'getClienteByNome: (nome) => {\n    return db.get(\'clientes\').find({ nome_completo: nome }).value();\n  },';
    const newFunction = `
  createCliente: (cliente) => {
    const { v4: uuidv4 } = require('uuid');
    const newCliente = {
      id: uuidv4(),
      ...cliente,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    db.get('clientes').push(newCliente).write();
    return newCliente;
  },`;

    if (content.includes(insertionPoint)) {
        content = content.replace(insertionPoint, insertionPoint + newFunction);
        fs.writeFileSync(path, content);
        console.log('Função createCliente injetada com sucesso.');
    } else {
        console.error('Ponto de inserção não encontrado.');
        process.exit(1);
    }
} catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
}
