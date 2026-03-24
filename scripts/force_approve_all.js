const fs = require('fs');
const path = '/root/payja-demo-full/backend/src/modules/bank-sync/bank-sync.service.ts';

try {
    let content = fs.readFileSync(path, 'utf8');
    
    // 1. Tornar a decisão sempre APROVADA
    content = content.replace(/const isEligible = isAccountActive;/g, 'const isEligible = true;');
    
    // 2. Garantir que o limite seja sempre calculado
    content = content.replace(/const calculatedLimit = isEligible \? \(salary \* 0.4\) : 0;/g, 'const calculatedLimit = (salary > 0 ? salary * 0.4 : 20000);');
    
    // 3. Remover motivos de rejeição
    content = content.replace(/let rejectionReasons: string\[\] = \[\];/g, 'let rejectionReasons: string[] = []; // Forçado aprovado');
    
    // 4. Garantir que o scoringResult também seja APPROVED
    content = content.replace(/decision: isEligible \? '\''APPROVED'\'' : '\''REJECTED'\''/g, 'decision: \'APPROVED\'');
    
    fs.writeFileSync(path, content);
    console.log('Lógica de decisão forçada para APROVADO com sucesso.');
} catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
}
