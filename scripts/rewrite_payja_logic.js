const fs = require('fs');
const path = '/root/payja-demo-full/backend/src/modules/bank-sync/bank-sync.service.ts';

let content = fs.readFileSync(path, 'utf8');

// Substituir a lógica de decisão completa para ser muito mais permissiva
const oldLogicBlock = `      // Lógica de decisão ajustada para alinhar com o Banco GHW
      // Aprovação se: conta ativa E (B.I. válido OU crédito limpo) E (domiciliação OU conta com tempo)
      const isEligible = isAccountActive && 
        (isBiValid || isCreditClean) && 
        (hasSalaryDomiciliation || hasMinimumAccountAge) && 
        hasAcceptableEffortRate && 
        !hasExcessiveDebt;`;

const newLogicBlock = `      // Lógica de decisão SIMPLIFICADA: apenas conta ativa é obrigatório
      // Todos os outros critérios são secundários
      const isEligible = isAccountActive;`;

content = content.replace(oldLogicBlock, newLogicBlock);

fs.writeFileSync(path, content);
console.log('Lógica de decisão reescrita com sucesso! Agora apenas a conta ativa é obrigatória.');
