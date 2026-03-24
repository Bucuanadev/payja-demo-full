const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const adapter = new FileSync(path.join(__dirname, '../banco.json'));
const db = low(adapter);

// Helper to generate dates
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

// Seed data
const seedData = () => {
  db.defaults({ 
    clientes: [], 
    transacoes: [], 
    validacoes: [], 
    desembolsos: [],
    emprestimos: [],
    pagamentos: [],
    consultas_capacidade: [],
    metrics: {
      last_payja_pull_at: null,
      last_payja_loans_sync_at: null
    }
  }).write();

  if (db.get('clientes').size().value() === 0) {
    const clientes = [
      // 1. Elegível - Assalariado, BI OK, Conta Antiga
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
        conta_criada_em: generateDate(12),
        tem_emprestimo_ativo: false,
        status_credito: 'LIMPO',
        divida_total: 0,
        score_credito: 750,
        historico_pagamentos: 'BOM',
        criado_em: generateDate(12),
        atualizado_em: new Date().toISOString(),
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
        criado_em: generateDate(24),
        atualizado_em: new Date().toISOString(),
      },
      // 3. Não Elegível - Conta Inativa
      {
        id: uuidv4(),
        nuit: '100456789',
        bi: '3456789012345P',
        bi_validade: generateFutureDate(36),
        nome_completo: 'Carlos Alberto Mondlane',
        telefone: '258843456789',
        email: 'carlos.mondlane@email.mz',
        numero_conta: '0001000000003',
        tipo_conta: 'CORRENTE',
        status_conta: 'INATIVA',
        saldo: 100,
        renda_mensal: 55000,
        salario_domiciliado: false,
        tipo_cliente: 'ASSALARIADO',
        conta_criada_em: generateDate(48),
        tem_emprestimo_ativo: false,
        status_credito: 'LIMPO',
        divida_total: 0,
        score_credito: 820,
        historico_pagamentos: 'EXCELENTE',
        criado_em: generateDate(48),
        atualizado_em: new Date().toISOString(),
      },
      // 4. Não Elegível - Conta Recente (< 6 meses)
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
        status_conta: 'ATIVA',
        saldo: 10000,
        renda_mensal: 18000,
        salario_domiciliado: false,
        tipo_cliente: 'INFORMAL',
        conta_criada_em: generateDate(2), // 2 meses atrás
        tem_emprestimo_ativo: false,
        status_credito: 'LIMPO',
        divida_total: 0,
        score_credito: 590,
        historico_pagamentos: 'REGULAR',
        criado_em: generateDate(2),
        atualizado_em: new Date().toISOString(),
      },
      // 5. Não Elegível - Crédito Incumpridor
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
        criado_em: generateDate(36),
        atualizado_em: new Date().toISOString(),
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
        criado_em: generateDate(72),
        atualizado_em: new Date().toISOString(),
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
        criado_em: generateDate(12),
        atualizado_em: new Date().toISOString(),
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
        criado_em: generateDate(24),
        atualizado_em: new Date().toISOString(),
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
        criado_em: generateDate(18),
        atualizado_em: new Date().toISOString(),
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
        criado_em: generateDate(120),
        atualizado_em: new Date().toISOString(),
      }
    ];

    // Add 10 more to reach 20
    for (let i = 11; i <= 20; i++) {
      const isEligible = i % 2 === 0;
      clientes.push({
        id: uuidv4(),
        nuit: `101${i}34567`,
        bi: `${i}234567890123N`,
        bi_validade: isEligible ? generateFutureDate(24) : generateDate(1),
        nome_completo: `Cliente Exemplo ${i}`,
        telefone: `25884${i}34567`,
        email: `cliente${i}@email.mz`,
        numero_conta: `00010000000${i}`,
        tipo_conta: i % 3 === 0 ? 'EMPRESARIAL' : 'SALARIO',
        status_conta: i === 13 ? 'INATIVA' : 'ATIVA',
        saldo: 5000 * i,
        renda_mensal: 10000 * (i % 5 + 1),
        salario_domiciliado: i % 2 === 0,
        tipo_cliente: i % 3 === 0 ? 'EMPRESARIAL' : (i % 2 === 0 ? 'ASSALARIADO' : 'INFORMAL'),
        conta_criada_em: generateDate(i * 2),
        tem_emprestimo_ativo: i % 4 === 0,
        status_credito: i % 4 === 0 ? 'ATIVO' : 'LIMPO',
        divida_total: i % 4 === 0 ? 5000 : 0,
        score_credito: 400 + (i * 20),
        historico_pagamentos: i % 4 === 0 ? 'REGULAR' : 'BOM',
        criado_em: generateDate(i * 2),
        atualizado_em: new Date().toISOString(),
      });
    }

    db.set('clientes', clientes).write();
    console.log('✅ Banco de dados do Banco Mock semeado com 20 clientes.');
  }
};

const queries = {
  // Clientes
  getClientes: () => {
    return db.get('clientes').value();
  },
  getAllClientes: () => {
    return db.get('clientes').value();
  },
  getClienteById: (id) => {
    return db.get('clientes').find({ id }).value();
  },
  getClienteByNuit: (nuit) => {
    return db.get('clientes').find({ nuit }).value();
  },
  getClienteByBi: (bi) => {
    return db.get('clientes').find({ bi }).value();
  },
  getClienteByTelefone: (telefone) => {
    return db.get('clientes').find({ telefone }).value();
  },
  getClienteByNome: (nome) => {
    return db.get('clientes').find({ nome_completo: nome }).value();
  },
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
  },
  updateCliente: (id, updates) => {
    db.get('clientes')
      .find({ id })
      .assign({
        ...updates,
        atualizado_em: new Date().toISOString(),
      })
      .write();
  },
  // Transações
  createTransacao: (transacao) => {
    const newTransacao = {
      id: uuidv4(),
      ...transacao,
      status: transacao.status || 'PENDENTE',
      criado_em: new Date().toISOString(),
    };
    
    db.get('transacoes').push(newTransacao).write();
    return newTransacao;
  },
  getTransacoesByCliente: (clienteId) => {
    return db.get('transacoes')
      .filter({ cliente_id: clienteId })
      .orderBy(['criado_em'], ['desc'])
      .value();
  },
  updateTransacao: (id, status, erro = null) => {
    db.get('transacoes')
      .find({ id })
      .assign({
        status,
        descricao: erro || db.get('transacoes').find({ id }).value().descricao,
      })
      .write();
  },
  // Validações
  createValidacao: (validacao) => {
    const newValidacao = {
      id: uuidv4(),
      ...validacao,
      requisicao: JSON.stringify(validacao.requisicao),
      resposta: validacao.resposta ? JSON.stringify(validacao.resposta) : null,
      status: validacao.status || 'PENDENTE',
      criado_em: new Date().toISOString(),
    };
    
    db.get('validacoes').push(newValidacao).write();
    return newValidacao;
  },
  getValidacoes: () => {
    return db.get('validacoes')
      .orderBy(['criado_em'], ['desc'])
      .take(100)
      .value();
  },
  // Desembolsos
  createDesembolso: (desembolso) => {
    const newDesembolso = {
      id: uuidv4(),
      ...desembolso,
      status: desembolso.status || 'PENDENTE',
      tentativas: 0,
      criado_em: new Date().toISOString(),
    };
    
    db.get('desembolsos').push(newDesembolso).write();
    return newDesembolso;
  },
  updateDesembolso: (id, updates) => {
    db.get('desembolsos')
      .find({ id })
      .assign(updates)
      .write();
  },
  getDesembolsos: () => {
    const desembolsos = db.get('desembolsos')
      .orderBy(['criado_em'], ['desc'])
      .take(100)
      .value();
    // Adicionar dados do cliente
    return desembolsos.map(d => {
      const cliente = db.get('clientes').find({ id: d.cliente_id }).value();
      return {
        ...d,
        nome_completo: cliente?.nome_completo || 'Desconhecido',
        numero_conta: cliente?.numero_conta || '-',
      };
    });
  },
  getAllValidacoes: () => {
    return db.get('validacoes').value();
  },
  getAllDesembolsos: () => {
    return db.get('desembolsos').value();
  },
  // Empréstimos
  createEmprestimo: (emprestimo) => {
    const newEmprestimo = {
      id: uuidv4(),
      numero: emprestimo.numero || `EMP-${Date.now()}`,
      ...emprestimo,
      status: emprestimo.status || 'ATIVO',
      dias_atraso: 0,
      criado_em: new Date().toISOString(),
    };
    
    db.get('emprestimos').push(newEmprestimo).write();
    return newEmprestimo;
  },
  getEmprestimosByNuit: (nuit) => {
    return db.get('emprestimos')
      .filter({ nuit })
      .orderBy(['criado_em'], ['desc'])
      .value();
  },
  getEmprestimoById: (id) => {
    return db.get('emprestimos').find({ id }).value();
  },
  getAllEmprestimos: () => {
    return db.get('emprestimos').value();
  },
  getEmprestimosAtivos: (nuit) => {
    return db.get('emprestimos')
      .filter({ nuit, status: 'ATIVO' })
      .value();
  },
  getEmprestimosInativos: (nuit) => {
    return db.get('emprestimos')
      .filter({ nuit })
      .filter(e => e.status === 'PAGO' || e.status === 'CANCELADO')
      .value();
  },
  getEmprestimo: (numero) => {
    return db.get('emprestimos').find({ numero }).value();
  },
  updateEmprestimo: (numero, updates) => {
    db.get('emprestimos')
      .find({ numero })
      .assign(updates)
      .write();
  },
  // Pagamentos
  createPagamento: (pagamento) => {
    const newPagamento = {
      id: uuidv4(),
      ...pagamento,
      criado_em: new Date().toISOString(),
    };
    
    db.get('pagamentos').push(newPagamento).write();
    return newPagamento;
  },
  getPagamentosEmprestimo: (numero_emprestimo) => {
    return db.get('pagamentos')
      .filter({ numero_emprestimo })
      .orderBy(['data'], ['desc'])
      .value();
  },
  // Consultas de Capacidade
  createConsultaCapacidade: (consulta) => {
    const newConsulta = {
      id: uuidv4(),
      ...consulta,
      criado_em: new Date().toISOString(),
    };
    
    db.get('consultas_capacidade').push(newConsulta).write();
    return newConsulta;
  },
  getAllConsultasCapacidade: () => {
    return db.get('consultas_capacidade').value();
  },
  getConsultasCapacidadeByNuit: (nuit) => {
    return db.get('consultas_capacidade')
      .filter({ nuit })
      .orderBy(['criado_em'], ['desc'])
      .value();
  },
  
  // Métricas
  setLastPayjaPull: () => {
    db.set('metrics.last_payja_pull_at', new Date().toISOString()).write();
  },
  setLastPayjaLoansSync: () => {
    db.set('metrics.last_payja_loans_sync_at', new Date().toISOString()).write();
  },
  getMetrics: () => {
    return db.get('metrics').value();
  },
};

module.exports = {
  db,
  init: seedData,
  ...queries,
};
