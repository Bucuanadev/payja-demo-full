const fs = require('fs');
const path = '/root/payja-demo-full/backend/src/modules/bank-sync/bank-sync.service.ts';

let content = fs.readFileSync(path, 'utf8');

// Substituir a lógica de decisão para ser mais permissiva e alinhada com o Banco
const oldLogic = `const isEligible = isAccountActive && isBiValid && isCreditClean && hasMinimumAccountAge && hasSalaryDomiciliation && hasAcceptableEffortRate && !hasExcessiveDebt;`;

const newLogic = `// Lógica de decisão ajustada para alinhar com o Banco GHW
      // Aprovação se: conta ativa E (B.I. válido OU crédito limpo) E (domiciliação OU conta com tempo)
      const isEligible = isAccountActive && 
        (isBiValid || isCreditClean) && 
        (hasSalaryDomiciliation || hasMinimumAccountAge) && 
        hasAcceptableEffortRate && 
        !hasExcessiveDebt;`;

content = content.replace(oldLogic, newLogic);

fs.writeFileSync(path, content);
console.log('Lógica de decisão actualizada com sucesso!');
