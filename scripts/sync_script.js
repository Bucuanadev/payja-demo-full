const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PAYJA_API_URL = 'http://localhost:3000/api/v1';
const BANCO_JSON_PATH = '/root/payja-demo-full/banco-mock/backend/banco.json';

async function sync() {
  try {
    console.log('Lendo banco.json...');
    const data = JSON.parse(fs.readFileSync(BANCO_JSON_PATH, 'utf8'));
    const clientes = data.clientes;
    console.log(`Encontrados ${clientes.length} clientes no banco-mock.`);

    for (const cliente of clientes) {
      console.log(`Sincronizando ${cliente.nome_completo} (${cliente.nuit})...`);
      
      const hoje = new Date();
      const validadeBI = new Date(cliente.bi_validade);
      const dataCriacaoConta = new Date(cliente.conta_criada_em);
      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
      
      let motivos = [];
      if (cliente.status_conta !== 'ATIVA') motivos.push('Conta inativa');
      if (validadeBI < hoje) motivos.push('B.I. expirado');
      if (dataCriacaoConta > seisMesesAtras) motivos.push('Tempo de conta insuficiente (< 6 meses)');
      if (cliente.tipo_cliente === 'ASSALARIADO' && cliente.salario_domiciliado === false) motivos.push('Salário não domiciliado');
      if (cliente.status_credito === 'INCUMPRIDOR') motivos.push('Histórico de incumprimento');
      
      const rendaLiquida = cliente.renda_mensal || 0;
      const dividaExistente = cliente.divida_total || 0;
      const taxaEsforcoMaxima = 0.4;
      const capacidadeMensal = (rendaLiquida * taxaEsforcoMaxima) - (dividaExistente * 0.1);
      
      if (capacidadeMensal <= 0) motivos.push('Taxa de esforço elevada');

      const isEligible = motivos.length === 0;
      const creditLimit = isEligible ? Math.round(rendaLiquida * 0.4) : 0;

      const payload = {
        event: 'customer.updated',
        data: {
          ...cliente,
          verified: isEligible,
          limite_credito: creditLimit,
          motivos_rejeicao: motivos.join(', ')
        }
      };

      try {
        await axios.post(`${PAYJA_API_URL}/webhooks/bank-sync`, payload);
        console.log(`  -> Sincronizado: ${isEligible ? 'APROVADO' : 'REJEITADO'} (Limite: ${creditLimit})`);
      } catch (err) {
        console.error(`  -> Erro ao sincronizar ${cliente.nuit}: ${err.message}`);
      }
    }
    console.log('Sincronização concluída!');
  } catch (error) {
    console.error('Erro fatal:', error.message);
  }
}

sync();
