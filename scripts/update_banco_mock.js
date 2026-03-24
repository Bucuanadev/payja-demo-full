const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dbPath = '/root/payja-demo-full/banco-mock/backend/data/db.json';
const adapter = new FileSync(dbPath);
const db = low(adapter);

// Limpar clientes existentes
db.set('clientes', []).write();

const generateDate = (monthsAgo) => {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date.toISOString();
};

const generateFutureDate = (monthsAhead) => {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsAhead);
  return date.toISOString();
};

const clientes = [
  // 1. Elegível - Assalariado, BI OK, Conta Antiga, Sem Dívidas
  {
    id: uuidv4(),
    nuit: '100234567',
    bi: '1234567890123N',
    bi_validade: generateFutureDate(24),
    nome_completo: 'João Pedro da Silva',
    telefone: '258841234567',
    email: 'joao.silva@email.mz',
    numero_conta: '0001000000001',
    tipo_conta: 'SALARIO',
    status_conta: 'ATIVA',
    saldo: 25000,
    renda_mensal: 35000,
    salario_domiciliado: true,
    tipo_cliente: 'ASSALARIADO',
    conta_criada_em: generateDate(48),
    tem_emprestimo_ativo: false,
    status_credito: 'LIMPO',
    divida_total: 0,
    score_credito: 750,
    historico_pagamentos: 'BOM',
    criado_em: new Date().toISOString(),
  },
  // 2. Não Elegível - BI Expirado
  {
    id: uuidv4(),
    nuit: '100345678',
    bi: '2345678901234M',
    bi_validade: generateDate(2), // Expirado há 2 meses
    nome_completo: 'Maria Santos Machado',
    telefone: '258842345678',
    email: 'maria.santos@email.mz',
    numero_conta: '0001000000002',
    tipo_conta: 'SALARIO',
    status_conta: 'ATIVA',
    saldo: 15000,
    renda_mensal: 25000,
    salario_domiciliado: true,
    tipo_cliente: 'ASSALARIADO',
    conta_criada_em: generateDate(24),
    tem_emprestimo_ativo: false,
    status_credito: 'LIMPO',
    divida_total: 0,
    score_credito: 680,
    historico_pagamentos: 'BOM',
    criado_em: new Date().toISOString(),
  },
  // 3. Não Elegível - Conta Recente (< 6 meses)
  {
    id: uuidv4(),
    nuit: '100456789',
    bi: '3456789012345P',
    bi_validade: generateFutureDate(36),
    nome_completo: 'Carlos Alberto Mondlane',
    telefone: '258843456789',
    email: 'carlos.mondlane@email.mz',
    numero_conta: '0001000000003',
    tipo_conta: 'SALARIO',
    status_conta: 'ATIVA',
    saldo: 5000,
    renda_mensal: 55000,
    salario_domiciliado: true,
    tipo_cliente: 'ASSALARIADO',
    conta_criada_em: generateDate(3), // 3 meses apenas
    tem_emprestimo_ativo: false,
    status_credito: 'LIMPO',
    divida_total: 0,
    score_credito: 820,
    historico_pagamentos: 'EXCELENTE',
    criado_em: new Date().toISOString(),
  },
  // 4. Não Elegível - Conta Inativa
  {
    id: uuidv4(),
    nuit: '100567890',
    bi: '4567890123456L',
    bi_validade: generateFutureDate(12),
    nome_completo: 'Ana Isabel Cossa',
    telefone: '258844567890',
    email: 'ana.cossa@email.mz',
    numero_conta: '0001000000004',
    tipo_conta: 'CORRENTE',
    status_conta: 'INATIVA',
    saldo: 100,
    renda_mensal: 18000,
    salario_domiciliado: false,
    tipo_cliente: 'INFORMAL',
    conta_criada_em: generateDate(60),
    tem_emprestimo_ativo: false,
    status_credito: 'LIMPO',
    divida_total: 0,
    score_credito: 400,
    historico_pagamentos: 'REGULAR',
    criado_em: new Date().toISOString(),
  },
  // 5. Não Elegível - Incumpridor (Crédito a correr com atraso)
  {
    id: uuidv4(),
    nuit: '100678901',
    bi: '5678901234567K',
    bi_validade: generateFutureDate(48),
    nome_completo: 'Pedro Manuel Sitoe',
    telefone: '258845678901',
    email: 'pedro.sitoe@email.mz',
    numero_conta: '0001000000005',
    tipo_conta: 'SALARIO',
    status_conta: 'ATIVA',
    saldo: 2000,
    renda_mensal: 42000,
    salario_domiciliado: true,
    tipo_cliente: 'ASSALARIADO',
    conta_criada_em: generateDate(36),
    tem_emprestimo_ativo: true,
    status_credito: 'INCUMPRIDOR',
    divida_total: 15000,
    score_credito: 350,
    historico_pagamentos: 'MAU',
    criado_em: new Date().toISOString(),
  },
  // 6. Elegível - Empresarial, BI OK, Conta Antiga
  {
    id: uuidv4(),
    nuit: '100789012',
    bi: '6789012345678J',
    bi_validade: generateFutureDate(60),
    nome_completo: 'Lúcia Fernanda Tembe',
    telefone: '258846789012',
    email: 'lucia.tembe@empresa.mz',
    numero_conta: '0001000000006',
    tipo_conta: 'EMPRESARIAL',
    status_conta: 'ATIVA',
    saldo: 150000,
    renda_mensal: 85000,
    salario_domiciliado: false,
    tipo_cliente: 'EMPRESARIAL',
    conta_criada_em: generateDate(72),
    tem_emprestimo_ativo: false,
    status_credito: 'LIMPO',
    divida_total: 0,
    score_credito: 880,
    historico_pagamentos: 'EXCELENTE',
    criado_em: new Date().toISOString(),
  },
  // 7. Não Elegível - Taxa de Esforço Alta (Dívida alta vs Renda)
  {
    id: uuidv4(),
    nuit: '100890123',
    bi: '7890123456789H',
    bi_validade: generateFutureDate(12),
    nome_completo: 'Ricardo Jorge Langa',
    telefone: '258847890123',
    email: 'ricardo.langa@email.mz',
    numero_conta: '0001000000007',
    tipo_conta: 'SALARIO',
    status_conta: 'ATIVA',
    saldo: 500,
    renda_mensal: 20000,
    salario_domiciliado: true,
    tipo_cliente: 'ASSALARIADO',
    conta_criada_em: generateDate(12),
    tem_emprestimo_ativo: true,
    status_credito: 'ATIVO',
    divida_total: 12000, // 60% de esforço se considerar prestação
    score_credito: 500,
    historico_pagamentos: 'REGULAR',
    criado_em: new Date().toISOString(),
  },
  // 8. Elegível - Informal com bom saldo e tempo de conta
  {
    id: uuidv4(),
    nuit: '100901234',
    bi: '8901234567890G',
    bi_validade: generateFutureDate(24),
    nome_completo: 'Beatriz Augusta Nhaca',
    telefone: '258848901234',
    email: 'beatriz.nhaca@email.mz',
    numero_conta: '0001000000008',
    tipo_conta: 'CORRENTE',
    status_conta: 'ATIVA',
    saldo: 45000,
    renda_mensal: 30000,
    salario_domiciliado: false,
    tipo_cliente: 'INFORMAL',
    conta_criada_em: generateDate(24),
    tem_emprestimo_ativo: false,
    status_credito: 'LIMPO',
    divida_total: 0,
    score_credito: 620,
    historico_pagamentos: 'BOM',
    criado_em: new Date().toISOString(),
  },
  // 9. Não Elegível - Salário não domiciliado
  {
    id: uuidv4(),
    nuit: '101012345',
    bi: '9012345678901F',
    bi_validade: generateFutureDate(36),
    nome_completo: 'Samuel David Matsinhe',
    telefone: '258849012345',
    email: 'samuel.matsinhe@email.mz',
    numero_conta: '0001000000009',
    tipo_conta: 'CORRENTE',
    status_conta: 'ATIVA',
    saldo: 1200,
    renda_mensal: 40000,
    salario_domiciliado: false,
    tipo_cliente: 'ASSALARIADO',
    conta_criada_em: generateDate(18),
    tem_emprestimo_ativo: false,
    status_credito: 'LIMPO',
    divida_total: 0,
    score_credito: 550,
    historico_pagamentos: 'BOM',
    criado_em: new Date().toISOString(),
  },
  // 10. Elegível - Assalariado, BI OK, Limite Alto
  {
    id: uuidv4(),
    nuit: '101123456',
    bi: '0123456789012E',
    bi_validade: generateFutureDate(48),
    nome_completo: 'Helena Sofia Magaia',
    telefone: '258840123456',
    email: 'helena.magaia@email.mz',
    numero_conta: '0001000000010',
    tipo_conta: 'SALARIO',
    status_conta: 'ATIVA',
    saldo: 85000,
    renda_mensal: 120000,
    salario_domiciliado: true,
    tipo_cliente: 'ASSALARIADO',
    conta_criada_em: generateDate(120),
    tem_emprestimo_ativo: false,
    status_credito: 'LIMPO',
    divida_total: 0,
    score_credito: 950,
    historico_pagamentos: 'EXCELENTE',
    criado_em: new Date().toISOString(),
  }
];

// Adicionar mais 10 clientes genéricos para completar 20
for (let i = 11; i <= 20; i++) {
  const isEligible = i % 2 === 0;
  clientes.push({
    id: uuidv4(),
    nuit: `101${i}34567`,
    bi: `${i}234567890123N`,
    bi_validade: isEligible ? generateFutureDate(12) : generateDate(1),
    nome_completo: `Cliente Exemplo ${i}`,
    telefone: `25884${i}123456`,
    email: `cliente${i}@email.mz`,
    numero_conta: `00010000000${i}`,
    tipo_conta: isEligible ? 'SALARIO' : 'CORRENTE',
    status_conta: isEligible ? 'ATIVA' : (i === 15 ? 'INATIVA' : 'ATIVA'),
    saldo: isEligible ? 10000 : 500,
    renda_mensal: isEligible ? 25000 : 8000,
    salario_domiciliado: isEligible,
    tipo_cliente: isEligible ? 'ASSALARIADO' : 'INFORMAL',
    conta_criada_em: generateDate(isEligible ? 24 : 2),
    tem_emprestimo_ativo: !isEligible && i === 13,
    status_credito: (!isEligible && i === 13) ? 'INCUMPRIDOR' : 'LIMPO',
    divida_total: (!isEligible && i === 13) ? 5000 : 0,
    score_credito: isEligible ? 700 : 300,
    historico_pagamentos: isEligible ? 'BOM' : 'REGULAR',
    criado_em: new Date().toISOString(),
  });
}

db.get('clientes').push(...clientes).write();
console.log('✅ 20 clientes diversificados inseridos com sucesso!');
