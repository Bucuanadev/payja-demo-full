const fs = require('fs');

// Ler o arquivo
let content = fs.readFileSync('src/modules/ussd/ussd.routes.js', 'utf8');

// Adicionar funções de validação após os imports
const validationFunctions = 
// Validar número de celular (deve começar com 86 ou 87)
function isValidMozambiquePhone(phoneNumber) {
  const cleaned = phoneNumber.replace(/\\D/g, '');
  if (cleaned.length === 9 && (cleaned.startsWith('86') || cleaned.startsWith('87'))) return true;
  if (cleaned.length === 12 && cleaned.startsWith('258') && 
      (cleaned.substring(3, 5) === '86' || cleaned.substring(3, 5) === '87')) return true;
  return false;
}

function normalizePhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/\\D/g, '');
  if (cleaned.length === 9) return '+258' + cleaned;
  if (cleaned.length === 12 && cleaned.startsWith('258')) return '+' + cleaned;
  return phoneNumber;
}
;

// Adicionar validação no início da rota /session
content = content.replace(
  'const activeSessions = new Map();',
  validationFunctions + '\nconst activeSessions = new Map();'
);

// Adicionar validação no endpoint /session
content = content.replace(
  if (!phoneNumber) {
      return res.status(400).json({
        error: 'phoneNumber é obrigatório',
      });
    },
  if (!phoneNumber) {
      return res.status(400).json({
        error: 'phoneNumber é obrigatório',
      });
    }

    // Validar número (apenas 86 ou 87)
    if (!isValidMozambiquePhone(phoneNumber)) {
      return res.status(400).json({
        error: 'Número inválido. Use números que começam com 86 ou 87.',
        message: 'END ❌ Número inválido.\\n\\nApenas números 86 ou 87 são aceites.\\n\\nExemplo: 860000000',
      });
    }

    // Normalizar número
    phoneNumber = normalizePhoneNumber(phoneNumber);
);

fs.writeFileSync('src/modules/ussd/ussd.routes.js', content, 'utf8');
console.log('✅ Arquivo atualizado com sucesso!');
