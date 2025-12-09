import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class BancoWebhooksService {
  private readonly logger = new Logger(BancoWebhooksService.name);

  constructor(private prisma: PrismaService) {}

  async processarPagamento(payload: any) {
    this.logger.log('💰 Processando pagamento recebido via CEDSIF');
    
    const { evento, origem, dados } = payload;

    if (evento !== 'pagamento_recebido') {
      throw new Error('Evento desconhecido');
    }

    const {
      nuit,
      numero_emprestimo,
      valor_pago,
      valor_pendente,
      status_emprestimo,
      referencia,
      data_pagamento,
      comissoes,
    } = dados;

    // Registrar webhook recebido
    this.logger.log(`Pagamento: ${valor_pago} MZN`);
    this.logger.log(`Empréstimo: ${numero_emprestimo}`);
    this.logger.log(`Status: ${status_emprestimo}`);
    this.logger.log(`Comissões: Banco=${comissoes.banco_welli.valor}, PayJA=${comissoes.payja.valor}, Emola=${comissoes.emola.valor}`);

    // TODO: Aqui você deve:
    // 1. Atualizar o status do empréstimo no banco de dados PayJA
    // 2. Registrar o pagamento recebido
    // 3. Distribuir as comissões (enviar para Emola, etc.)
    // 4. Notificar o cliente via SMS/USSD
    
    // Exemplo simplificado (você deve implementar conforme sua lógica de negócio):
    /*
    await this.prisma.loan.update({
      where: { numero_emprestimo },
      data: {
        valor_pendente,
        status: status_emprestimo === 'PAGO' ? 'PAID' : 'ACTIVE',
      },
    });

    await this.prisma.payment.create({
      data: {
        nuit,
        numero_emprestimo,
        valor: valor_pago,
        origem: 'CEDSIF',
        referencia,
        data_pagamento: new Date(data_pagamento),
        comissao_banco: parseFloat(comissoes.banco_welli.valor),
        comissao_payja: parseFloat(comissoes.payja.valor),
        comissao_emola: parseFloat(comissoes.emola.valor),
      },
    });
    */

    this.logger.log('✅ Pagamento processado com sucesso');

    return {
      processed: true,
      numero_emprestimo,
      valor_pago,
      status: status_emprestimo,
      comissoes_registradas: true,
    };
  }

  async processarDesembolso(payload: any) {
    this.logger.log('💸 Processando webhook de desembolso');
    
    const { evento, dados } = payload;

    if (evento !== 'desembolso_concluido') {
      throw new Error('Evento desconhecido');
    }

    const {
      nuit,
      numero_conta,
      valor,
      referencia_payja,
      status,
    } = dados;

    this.logger.log(`Desembolso: ${valor} MZN para ${numero_conta}`);
    this.logger.log(`Status: ${status}`);

    // TODO: Atualizar status do desembolso no PayJA
    /*
    await this.prisma.disbursement.update({
      where: { referencia_payja },
      data: {
        status: status === 'CONCLUIDO' ? 'COMPLETED' : 'FAILED',
        processado_em: new Date(),
      },
    });
    */

    this.logger.log('✅ Webhook de desembolso processado');

    return {
      processed: true,
      referencia_payja,
      status,
    };
  }
}
