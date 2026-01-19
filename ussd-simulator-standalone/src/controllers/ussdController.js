// src/controllers/ussdController.js
class UssdController {
  async processUssd(req, res) {
    try {
      const { sessionId, phoneNumber, text, networkCode, serviceCode } = req.body;
      console.log('📞 Processando USSD para:', phoneNumber);
      const db = req.app.locals.db;
      let customer = null;
      if (db) {
        customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [phoneNumber]);
      }
      let response = '';
      const textArray = text ? text.split('*') : [];
      const userInput = textArray[textArray.length - 1] || '';
      if (text === '') {
        response = this.getMainMenu(customer);
      } else if (text === '1') {
        response = this.getBalanceMenu(customer);
      } else if (text === '2') {
        response = 'CON Digite o número do destinatário:';
      } else if (text === '3') {
        response = this.getServicesMenu();
      } else if (text === '4') {
        response = this.getProfileMenu(customer);
      } else if (text === '5') {
        response = this.getHelpMenu();
      } else if (text === '0') {
        response = 'END Obrigado por usar PayJA. Até logo!';
      } else {
        response = 'CON Opção inválida. Tente novamente.\n\n0. Sair';
      }
      res.set('Content-Type', 'text/plain');
      res.send(response);
    } catch (error) {
      console.error('❌ Erro no controller USSD:', error);
      res.status(500).send('END Ocorreu um erro. Tente novamente.');
    }
  }
  getMainMenu(customer) {
    const welcomeMessage = customer 
      ? `Bem-vindo de volta, ${customer.firstName || 'Cliente'}!`
      : 'Bem-vindo ao PayJA USSD';
    return `CON ${welcomeMessage}
\n1. Verificar saldo\n2. Transferir dinheiro\n3. Pagar serviços\n4. Meu perfil\n5. Ajuda\n\n0. Sair`;
  }
  getBalanceMenu(customer) {
    const balance = customer ? customer.balance || 0 : 0;
    const formattedBalance = new Intl.NumberFormat('pt-MZ', {
      style: 'currency',
      currency: 'MZN'
    }).format(balance);
    return `CON Seu saldo disponível:\n${formattedBalance}\n\n1. Ver extrato\n2. Recarregar conta\n3. Voltar ao menu\n0. Sair`;
  }
  getServicesMenu() {
    return `CON Pagamento de serviços:\n\n1. EDM (Electricidade)\n2. Águas da Região\n3. TV por assinatura\n4. Internet\n5. Universidade\n\n6. Voltar ao menu\n0. Sair`;
  }
  getProfileMenu(customer) {
    if (!customer) {
      return 'CON Cliente não encontrado no sistema.\n\n0. Sair';
    }
    return `CON Meu perfil:\n\nNome: ${customer.firstName || ''} ${customer.lastName || ''}\nNUIT: ${customer.nuit || 'Não informado'}\nStatus: ${customer.status === 'verified' ? '✅ Verificado' : '⏳ Pendente'}\nLimite de crédito: ${customer.creditLimit || customer.customerLimit || 0} MZN\n\n1. Alterar PIN\n2. Histórico de transações\n3. Configurações\n4. Voltar ao menu\n0. Sair`;
  }
  getHelpMenu() {
    return `CON Ajuda e Suporte:\n\nPara suporte técnico:\n📞 84 123 4567\n✉️ suporte@payja.co.mz\n🕘 24h/dia, 7d/semana\n\n1. Perguntas frequentes\n2. Falar com atendente\n3. Voltar ao menu\n0. Sair`;
  }
  async getCustomer(req, res) {
    try {
      const { msisdn } = req.params;
      const db = req.app.locals.db;
      if (!db) {
        return res.status(500).json({ error: 'Banco de dados não disponível' });
      }
      let customer = null;
      try {
        customer = await db.get('SELECT * FROM customers WHERE phoneNumber = ?', [msisdn]);
      } catch (err) {
        // fallback para coluna msisdn se existir
        try {
          customer = await db.get('SELECT * FROM customers WHERE msisdn = ?', [msisdn]);
        } catch (err2) {
          customer = null;
        }
      }
      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      res.json({
        success: true,
        customer: {
          id: customer.id,
          msisdn: customer.msisdn,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
          creditScore: customer.creditScore,
          balance: customer.balance,
          creditLimit: customer.creditLimit || customer.customerLimit || 0,
          status: customer.status,
          isActive: customer.isActive === 1
        }
      });
    } catch (error) {
      console.error('❌ Erro ao buscar cliente:', error);
      res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
  }
  async listCustomers(req, res) {
    try {
      const db = req.app.locals.db;
      if (!db) {
        return res.status(500).json({ error: 'Banco de dados não disponível' });
      }
      const customers = await db.all(`
         SELECT id, msisdn, firstName, lastName, 
           creditScore, balance, creditLimit, 
               status, isActive, updatedAt 
        FROM customers 
        ORDER BY updatedAt DESC
      `);
      res.json({
        success: true,
        count: customers.length,
        customers: customers.map(c => ({
          ...c,
          isActive: c.isActive === 1
        }))
      });
    } catch (error) {
      console.error('❌ Erro ao listar clientes:', error);
      res.status(500).json({ error: 'Erro ao listar clientes' });
    }
  }
}

module.exports = new UssdController();
