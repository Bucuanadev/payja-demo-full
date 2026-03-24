const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/root/payja-demo-full/backend/prisma/dev.db'
    }
  }
});

const BANCO_JSON_PATH = '/root/payja-demo-full/banco-mock/backend/banco.json';

async function main() {
  try {
    const data = JSON.parse(fs.readFileSync(BANCO_JSON_PATH, 'utf8'));
    const clientesBanco = data.clientes;
    
    const customers = await prisma.customer.findMany();
    console.log('Encontrados ' + customers.length + ' clientes no banco de dados.');

    for (const customer of customers) {
      const clienteBanco = clientesBanco.find(c => c.nuit === customer.nuit);

      const hoje = new Date();
      const validadeBI = new Date(clienteBanco.bi_validade);
      const dataCriacaoConta = new Date(clienteBanco.conta_criada_em);
      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
      
      let motivos = [];
      if (clienteBanco.status_conta !== 'ATIVA') motivos.push('Conta inativa');
      if (validadeBI < hoje) motivos.push('B.I. expirado');
      if (dataCriacaoConta > seisMesesAtras) motivos.push('Tempo de conta insuficiente (< 6 meses)');
      if (clienteBanco.tipo_cliente === 'ASSALARIADO' && clienteBanco.salario_domiciliado === false) motivos.push('Salário não domiciliado');
      if (clienteBanco.status_credito === 'INCUMPRIDOR') motivos.push('Histórico de incumprimento');
      
      const rendaLiquida = clienteBanco.renda_mensal || 0;
      const dividaExistente = clienteBanco.divida_total || 0;
      const taxaEsforcoMaxima = 0.4;
      const capacidadeMensal = (rendaLiquida * taxaEsforcoMaxima) - (dividaExistente * 0.1);
      
      if (capacidadeMensal <= 0) motivos.push('Taxa de esforço elevada');

      const isEligible = (motivos.length === 0);
      
      await prisma.scoringResult.create({
        data: {
          customerId: customer.id,
          finalScore: isEligible ? 700 : 300,
          risk: isEligible ? 'LOW' : 'VERY_HIGH',
          decision: isEligible ? 'APPROVED' : 'REJECTED',
          maxAmount: isEligible ? Math.round(rendaLiquida * 0.4) : 0,
          factors: JSON.stringify({
            bankReason: motivos.join(' | '),
            isEligible: isEligible
          })
        }
      });
      
      console.log('Scoring criado para ' + customer.name + ': ' + (isEligible ? 'APROVADO' : 'REJECTED'));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.();
  }
}

main();
