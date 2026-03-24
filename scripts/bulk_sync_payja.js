const axios = require('axios');

const BANCO_MOCK_API = 'http://104.207.142.188:4500/api';
const PAYJA_API = 'http://104.207.142.188:3000/api/v1';

async function runBulkSync() {
  console.log('🚀 Iniciando Sincronização em Massa: Banco Mock -> PayJA');
  
  try {
    // 1. Buscar todos os clientes do Banco Mock
    console.log('📥 Buscando clientes do Banco Mock...');
    const response = await axios.get(`${BANCO_MOCK_API}/clientes`);
    const clientes = response.data.clientes;
    console.log(`✅ Encontrados ${clientes.length} clientes.`);

    for (const cliente of clientes) {
      console.log(`\n🔍 Processando Cliente: ${cliente.nome_completo} (NUIT: ${cliente.nuit})`);
      
      // 2. Simular uma verificação de elegibilidade no PayJA
      // Como o PayJA normalmente faz isso via USSD ou Admin, vamos chamar o endpoint de validação
      // que criamos no ScoringService (através de um novo endpoint temporário ou simulando a lógica)
      
      // Para esta demonstração, vamos disparar a lógica de decisão diretamente
      // No ambiente real, o PayJA puxaria esses dados via Sync.
      
      // Vamos usar o endpoint de validação do Banco Mock que o PayJA consome
      const payload = {
        nuit: cliente.nuit,
        nome: cliente.nome_completo,
        telefone: cliente.telefone,
        bi: cliente.bi,
        valor_solicitado: 5000 // Valor padrão para teste de elegibilidade
      };

      try {
        // Simulando o que o PayJA faria internamente:
        // 1. Consulta o Banco
        // 2. Calcula Score
        // 3. Notifica o Banco de volta
        
        // Vamos chamar o endpoint de notificação do Banco Mock diretamente para popular as abas
        // simulando que o PayJA já processou.
        
        let status = 'REJEITADO';
        let motivo = '';
        let limite = 0;

        // Lógica de Elegibilidade (Espelhada do ScoringService)
        if (cliente.status_conta !== 'ATIVA') {
          motivo = 'Conta Bancária Inativa';
        } else if (new Date(cliente.bi_validade) < new Date()) {
          motivo = 'B.I. Expirado';
        } else if (cliente.status_credito === 'INCUMPRIDOR') {
          motivo = 'Histórico de Incumprimento Bancário';
        } else if (!cliente.salario_domiciliado && cliente.tipo_cliente === 'ASSALARIADO') {
          motivo = 'Salário não domiciliado neste banco';
        } else {
          // Cálculo de Taxa de Esforço (40%)
          const capacidadeMensal = cliente.renda_mensal * 0.4;
          const dividaMensalEstimada = cliente.divida_total / 12; // Simplificação
          const disponivel = capacidadeMensal - dividaMensalEstimada;

          if (disponivel <= 0) {
            motivo = 'Capacidade de pagamento insuficiente (Taxa de esforço > 40%)';
          } else {
            status = 'APROVADO';
            limite = Math.min(disponivel * 10, 50000); // Limite sugerido: 10x a capacidade mensal disponível
          }
        }

        console.log(`⚖️ Decisão PayJA: ${status} | Motivo: ${motivo || 'N/A'} | Limite: ${limite}`);

        // Notificar o Banco Mock (Feedback Loop)
        // Notificar o PayJA diretamente via Webhook do Banco
        await axios.post(`${PAYJA_API}/bank-sync/sync`, cliente);
        
        await axios.post(`${BANCO_MOCK_API}/validacao/resultado`, {
          nuit: cliente.nuit,
          status: status,
          motivo: motivo,
          limite_aprovado: limite
        });
        
        console.log(`📤 Banco Mock notificado com sucesso.`);

      } catch (err) {
        console.error(`❌ Erro ao processar cliente ${cliente.nuit}:`, err.message);
      }
    }

    console.log('\n✨ Sincronização em massa concluída!');

  } catch (error) {
    console.error('💥 Erro fatal na sincronização:', error.message);
  }
}

runBulkSync();
