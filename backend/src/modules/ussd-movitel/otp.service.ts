import { Injectable } from '@nestjs/common';
import { SmsService } from '../sms/sms.service';

interface OtpResult {
  code: string;
  expiresAt: Date;
}

@Injectable()
export class OtpService {
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;

  constructor(private smsService: SmsService) {}

  async generateAndSendOTP(
    sessionId: string,
    msisdn: string,
  ): Promise<OtpResult> {
    // Gerar código OTP de 6 dígitos
    const code = this.generateOtpCode();

    // Calcular expiração (10 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Enviar SMS
    const message = `PayJA Txeneka Male\n\nSeu codigo OTP: ${code}\n\nValido por ${this.OTP_EXPIRY_MINUTES} minutos.\n\nNao compartilhe este codigo.`;

    try {
      await this.smsService.sendSms(msisdn, message, 'VERIFICATION');
      console.log('[OTP] Codigo enviado:', {
        sessionId,
        msisdn,
        code,
        expiresAt,
      });
    } catch (error) {
      console.error('[OTP] Erro ao enviar SMS:', error);
      throw new Error('Falha ao enviar OTP');
    }

    return { code, expiresAt };
  }

  async verifyOTP(
    storedCode: string,
    userCode: string,
    expiryDate: Date,
  ): Promise<boolean> {
    // Verificar se código expirou
    if (new Date() > new Date(expiryDate)) {
      console.log('[OTP] Codigo expirado');
      return false;
    }

    // Verificar se código está correto
    if (storedCode !== userCode.trim()) {
      console.log('[OTP] Codigo incorreto:', {
        stored: storedCode,
        user: userCode,
      });
      return false;
    }

    console.log('[OTP] Codigo verificado com sucesso');
    return true;
  }

  async sendLoanConfirmation(
    msisdn: string,
    loanId: string,
    amount: number,
  ): Promise<void> {
    const message = `PayJA - Pedido de Emprestimo\n\nID: ${loanId.substring(0, 8)}\nValor: ${amount.toFixed(2)} MZN\n\nStatus: Em analise\n\nReceberá SMS com resultado em ate 24h.`;

    try {
      await this.smsService.sendSms(msisdn, message, 'NOTIFICATION');
      console.log('[OTP] SMS de confirmacao enviado:', { msisdn, loanId });
    } catch (error) {
      console.error('[OTP] Erro ao enviar SMS de confirmacao:', error);
    }
  }

  async sendRegistrationConfirmation(
    msisdn: string,
    nuit: string,
  ): Promise<void> {
    const message = `PayJA Txeneka Male\n\nRegistro confirmado!\nNUIT: ${nuit}\n\nAguarde validacao em ate 24h. Acesse *898# para solicitar emprestimo.`;

    try {
      await this.smsService.sendSms(msisdn, message, 'NOTIFICATION');
      console.log('[OTP] SMS de registro enviado:', { msisdn, nuit });
    } catch (error) {
      console.error('[OTP] Erro ao enviar SMS de registro:', error);
    }
  }

  async sendApprovalSMS(
    msisdn: string,
    loanId: string,
    amount: number,
    bankName: string,
  ): Promise<void> {
    const message = `PayJA - APROVADO!\n\nID: ${loanId.substring(0, 8)}\nValor: ${amount.toFixed(2)} MZN\nBanco: ${bankName}\n\nCredito sera depositado em ate 2 horas uteis.`;

    try {
      await this.smsService.sendSms(msisdn, message, 'LOAN_STATUS');
      console.log('[OTP] SMS de aprovacao enviado:', { msisdn, loanId });
    } catch (error) {
      console.error('[OTP] Erro ao enviar SMS de aprovacao:', error);
    }
  }

  async sendRejectionSMS(
    msisdn: string,
    loanId: string,
    reason: string,
  ): Promise<void> {
    const message = `PayJA - Nao Aprovado\n\nID: ${loanId.substring(0, 8)}\nMotivo: ${reason}\n\nContacte suporte: 0800-PAYJA`;

    try {
      await this.smsService.sendSms(msisdn, message, 'LOAN_STATUS');
      console.log('[OTP] SMS de rejeicao enviado:', { msisdn, loanId });
    } catch (error) {
      console.error('[OTP] Erro ao enviar SMS de rejeicao:', error);
    }
  }

  private generateOtpCode(): string {
    // Gerar número aleatório de 6 dígitos
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    const code = Math.floor(Math.random() * (max - min + 1)) + min;
    return code.toString();
  }

  async resendOTP(sessionId: string, msisdn: string): Promise<OtpResult> {
    console.log('[OTP] Reenviando codigo:', { sessionId, msisdn });
    return this.generateAndSendOTP(sessionId, msisdn);
  }
}
