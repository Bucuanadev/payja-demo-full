const fs = require('fs');
const path = '/root/payja-demo-full/backend/src/modules/bank-sync/bank-sync.service.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Atualizar o mapeamento do customerData para incluir campos extras no factors
const oldCustomerData = 'const customerData = {';
const newCustomerData = `const customerData = {
        phoneNumber: data.telefone || \`BANCO-\${data.nuit}\`,
        name: data.nome_completo,
        nuit: data.nuit,
        biNumber: data.bi,
        biExpiryDate: data.bi_validade, // Adicionado
        email: data.email || null,
        creditLimit: calculatedLimit,
        creditScore: data.score_credito || 500,
        salary: salary,
        salaryBank: 'Banco GHW',
        verified: isEligible,
        status: isEligible ? 'APPROVED' : 'REJECTED', // Forçar status correto
        rejectionReason: isEligible ? null : rejectionReasons.join(' | '), // Salvar motivo
      };`;

content = content.replace(/const customerData = \{[^}]+\};/s, newCustomerData);

// 2. Garantir que o status seja atualizado no Prisma update/create
content = content.replace('status: isEligible ? \'APPROVED\' : \'REJECTED\',', 'status: isEligible ? \'APPROVED\' : \'REJECTED\',');

fs.writeFileSync(path, content);
console.log('Backend updated successfully');
