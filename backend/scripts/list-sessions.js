const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listSessions() {
  try {
    const sessions = await prisma.ussdSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });
    
    console.log('\n📋 Sessões USSD recentes:\n');
    
    if (sessions.length === 0) {
      console.log('  Nenhuma sessão encontrada.\n');
    } else {
      sessions.forEach(s => {
        console.log(`  📱 ${s.phoneNumber}`);
        console.log(`     Session ID: ${s.sessionId}`);
        console.log(`     Step: ${s.currentStep}`);
        console.log(`     Ativa: ${s.isActive ? '✓' : '✗'}`);
        console.log(`     OTP: ${s.otpCode || 'N/A'} (Tentativas: ${s.otpAttempts})`);
        console.log(`     Iniciada: ${s.startedAt.toLocaleString()}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listSessions();
