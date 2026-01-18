const low = require('lowdb');
const Memory = require('lowdb/adapters/Memory');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const adapter = new Memory();
const db = low(adapter);

// Inicializar schema
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
    last_payja_loans_sync_at: null,
  },
}).write();

// Popular com dados fictícios se vazio
function seedData() {
  if (db.get('clientes').size().value() === 0) {
    console.log('🌱 Populando banco de dados com clientes fictícios...');

    const clientes = [
      {
        id: uuidv4(),
        nuit: '100234567',
        bi: '1234567890123N',
        nome_completo: 'João Pedro da Silva',
        telefone: '258841234567',
        email: 'joao.silva@email.mz',
        numero_conta: '0001000000001',
        tipo_conta: 'SALARIO',
        saldo: 25000,
        limite_credito: 50000,
        score_credito: 750,
        renda_mensal: 35000,
        salario: 35000,
        empregador: 'Ministério da Educação',
        status_conta: 'ATIVA',
        tem_descoberto: 0,
        valor_descoberto: 0,
        emprestimos_ativos: 0,
        divida_total: 0,
        historico_pagamentos: 'BOM',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        nuit: '100345678',
        bi: '2345678901234M',
        nome_completo: 'Maria Santos Machado',
        telefone: '258842345678',
        email: 'maria.santos@email.mz',
        numero_conta: '0001000000002',
        tipo_conta: 'SALARIO',
        saldo: 15000,
        limite_credito: 30000,
        score_credito: 680,
        renda_mensal: 25000,
        salario: 25000,
        empregador: 'Hospital Central de Maputo',
        status_conta: 'ATIVA',
        tem_descoberto: 0,
        valor_descoberto: 0,
        emprestimos_ativos: 0,
        divida_total: 0,
        historico_pagamentos: 'BOM',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        nuit: '100456789',
        bi: '3456789012345P',
        nome_completo: 'Carlos Alberto Mondlane',
        telefone: '258843456789',
        email: 'carlos.mondlane@email.mz',
        numero_conta: '0001000000003',
        tipo_conta: 'SALARIO',
        saldo: 45000,
        limite_credito: 80000,
        score_credito: 820,
        renda_mensal: 55000,
        salario: 55000,
        empregador: 'Banco de Moçambique',
        status_conta: 'ATIVA',
        tem_descoberto: 0,
        valor_descoberto: 0,
        emprestimos_ativos: 0,
        divida_total: 0,
        historico_pagamentos: 'EXCELENTE',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        nuit: '100567890',
        bi: '4567890123456L',
        nome_completo: 'Ana Isabel Cossa',
        telefone: '258844567890',
        email: 'ana.cossa@email.mz',
        numero_conta: '0001000000004',
        numero_emola: '864567890',
        tipo_conta: 'CORRENTE',
        saldo: 10000,
        limite_credito: 15000,
        score_credito: 590,
        renda_mensal: 18000,
        salario: 18000,
        empregador: 'EDM',
        status_conta: 'ATIVA',
        tem_descoberto: 0,
        valor_descoberto: 0,
        emprestimos_ativos: 0,
        divida_total: 0,
        historico_pagamentos: 'REGULAR',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        nuit: '100678901',
        bi: '5678901234567K',
        nome_completo: 'Pedro Manuel Sitoe',
        telefone: '258845678901',
        email: 'pedro.sitoe@email.mz',
        numero_conta: '0001000000005',
        tipo_conta: 'SALARIO',
        saldo: 32000,
        limite_credito: 60000,
        score_credito: 710,
        renda_mensal: 42000,
        salario: 42000,
        empregador: 'Ministério da Saúde',
        status_conta: 'ATIVA',
        tem_descoberto: 0,
        valor_descoberto: 0,
        emprestimos_ativos: 0,
        divida_total: 0,
        historico_pagamentos: 'BOM',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
    ];

    db.get('clientes').push(...clientes).write();
    console.log(`✅ ${clientes.length} clientes adicionados`);
  }
}

// Funções de consulta
const queries = {
  // Clientes
  getClienteByNuit: (nuit) => {
    return db.get('clientes').find({ nuit }).value();
  },

  getClienteById: (id) => {
    return db.get('clientes').find({ id }).value();
  },

  getAllClientes: () => {
    return db.get('clientes').orderBy(['criado_em'], ['desc']).value();
  },

  createCliente: (cliente) => {
    const newCliente = {
      id: uuidv4(),
      ...cliente,
      status_conta: cliente.status_conta || 'ATIVA',
      tipo_conta: cliente.tipo_conta || 'CORRENTE',
      saldo: cliente.saldo || 0,
      limite_credito: cliente.limite_credito || 0,
      score_credito: cliente.score_credito || 650,
      renda_mensal: cliente.renda_mensal || 0,
      tem_descoberto: 0,
      valor_descoberto: 0,
      emprestimos_ativos: 0,
      divida_total: 0,
      historico_pagamentos: 'BOM',
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
    
    return db.get('clientes').find({ id }).value();
  },

  getClienteByTelefone: (telefone) => {
    return db.get('clientes').find({ telefone }).value();
  },

  getClienteByNumeroConta: (numero_conta) => {
    return db.get('clientes').find({ numero_conta }).value();
  },

  getClienteByNome: (nome) => {
    // Search by exact match or partial match (case insensitive)
    const normalizedSearch = nome.toLowerCase().trim();
    return db.get('clientes').find((c) => {
      const clienteNome = c.nome_completo.toLowerCase().trim();
      return clienteNome === normalizedSearch || clienteNome.includes(normalizedSearch);
    }).value();
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
