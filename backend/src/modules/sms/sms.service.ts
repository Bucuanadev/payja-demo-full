import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface SmsMessage {
  id: string;
  phoneNumber: string;
  message: string;
  type: 'VERIFICATION' | 'NOTIFICATION' | 'LOAN_STATUS' | 'PAYMENT_REMINDER';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  sentAt?: Date;
  deliveredAt?: Date;
}

@Injectable()
export class SmsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Envia SMS (simulado)
   */
  async sendSms(
    phoneNumber: string,
    message: string,
    type: 'VERIFICATION' | 'NOTIFICATION' | 'LOAN_STATUS' | 'PAYMENT_REMINDER',
  ): Promise<SmsMessage> {
    // Em produção, aqui seria a integração com API de SMS (M-Pesa, E-Mola, etc)
    
    // Registrar no banco para simulação
    const sms = await this.prisma.smsLog.create({
      data: {
        phoneNumber,
        message,
        type,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    console.log(`[SMS] Enviado para ${phoneNumber}: ${message}`);

    return {
      id: sms.id,
      phoneNumber: sms.phoneNumber,
      message: sms.message,
      type: sms.type as any,
      status: 'SENT',
      sentAt: sms.sentAt,
    };
  }

  /**
   * Envia código de verificação
   */
  async sendVerificationCode(phoneNumber: string): Promise<string> {
    const code = this.generateVerificationCode();
    
    await this.sendSms(
      phoneNumber,
      `PayJA: Seu código de verificação é: ${code}. Válido por 10 minutos.`,
      'VERIFICATION',
    );

    // Armazenar código temporariamente
    await this.prisma.systemConfig.upsert({
      where: { key: `VERIFICATION_${phoneNumber}` },
      update: {
        value: code,
        updatedAt: new Date(),
      },
      create: {
        key: `VERIFICATION_${phoneNumber}`,
        value: code,
        category: 'VERIFICATION',
        description: `Código de verificação para ${phoneNumber}`,
      },
    });

    return code;
  }

  /**
   * Verifica código
   */
  async verifyCode(phoneNumber: string, code: string): Promise<boolean> {
    const stored = await this.prisma.systemConfig.findUnique({
      where: { key: `VERIFICATION_${phoneNumber}` },
    });

    if (!stored) return false;

    // Verificar se expirou (10 minutos)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (stored.updatedAt < tenMinutesAgo) {
      return false;
    }

    return stored.value === code;
  }

  /**
   * Notifica aprovação de empréstimo
   */
  async notifyLoanApproval(
    phoneNumber: string,
    loanId: string,
    amount: number,
  ): Promise<void> {
    await this.sendSms(
      phoneNumber,
      `PayJA: Seu empréstimo de ${amount} MZN foi APROVADO! Ref: ${loanId.substring(0, 8)}. O dinheiro será creditado em breve.`,
      'LOAN_STATUS',
    );
  }

  /**
   * Notifica rejeição de empréstimo
   */
  async notifyLoanRejection(
    phoneNumber: string,
    reason?: string,
  ): Promise<void> {
    const msg = reason
      ? `PayJA: Infelizmente seu empréstimo não foi aprovado. Motivo: ${reason}`
      : `PayJA: Infelizmente seu empréstimo não foi aprovado. Tente novamente em 30 dias.`;
    
    await this.sendSms(phoneNumber, msg, 'LOAN_STATUS');
  }

  /**
   * Notifica desembolso
   */
  async notifyDisbursement(
    phoneNumber: string,
    amount: number,
    reference: string,
  ): Promise<void> {
    await this.sendSms(
      phoneNumber,
      `PayJA: ${amount} MZN foi creditado na sua conta. Referência: ${reference}. Obrigado por usar PayJA!`,
      'NOTIFICATION',
    );
  }

  /**
   * Lembrete de pagamento
   */
  async sendPaymentReminder(
    phoneNumber: string,
    amount: number,
    dueDate: Date,
  ): Promise<void> {
    const dateStr = dueDate.toLocaleDateString('pt-MZ');
    await this.sendSms(
      phoneNumber,
      `PayJA: Lembrete! Pagamento de ${amount} MZN vence em ${dateStr}. Pague via *898# opção 2.`,
      'PAYMENT_REMINDER',
    );
  }

  /**
   * Lista SMS recebidos (para simulador)
   */
  async getReceivedSms(phoneNumber: string, limit = 10): Promise<SmsMessage[]> {
    const messages = await this.prisma.smsLog.findMany({
      where: { phoneNumber },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.map((msg) => ({
      id: msg.id,
      phoneNumber: msg.phoneNumber,
      message: msg.message,
      type: msg.type as any,
      status: msg.status as any,
      sentAt: msg.sentAt,
      deliveredAt: msg.deliveredAt,
    }));
  }

  /**
   * Lista todos os SMS recentes (para admin/dashboard)
   */
  async getAllRecentSms(limit = 50): Promise<SmsMessage[]> {
    const messages = await this.prisma.smsLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.map((msg) => ({
      id: msg.id,
      phoneNumber: msg.phoneNumber,
      message: msg.message,
      type: msg.type as any,
      status: msg.status as any,
      sentAt: msg.sentAt,
      deliveredAt: msg.deliveredAt,
    }));
  }

  /**
   * Marca SMS como lido
   */
  async markAsRead(smsId: string): Promise<void> {
    await this.prisma.smsLog.update({
      where: { id: smsId },
      data: { 
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
