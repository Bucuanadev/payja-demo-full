const fs = require('fs');
const path = '/root/payja-demo-full/desktop/src/pages/CustomersPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const factorsExtraction = `
  const getFactor = (key) => {
    try {
      const factors = JSON.parse(selectedCustomer.scoringResults?.[0]?.factors || '{}');
      return factors.bankData?.[key] || factors[key] || 'N/A';
    } catch (e) { return 'N/A'; }
  };
`;

const newDescriptions = `
            <Descriptions title="Informações Cadastrais e Financeiras (Paridade Banco GHW)" bordered column={2} size="small">
              <Descriptions.Item label="Nome Completo" span={2}>
                <Text strong>{selectedCustomer.name || 'Não informado'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="NUIT">{selectedCustomer.nuit || 'Não informado'}</Descriptions.Item>
              <Descriptions.Item label="BI">{selectedCustomer.biNumber || 'Não informado'}</Descriptions.Item>
              <Descriptions.Item label="Validade do B.I.">{selectedCustomer.biExpiryDate ? new Date(selectedCustomer.biExpiryDate).toLocaleDateString('pt-MZ') : 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Telefone">{selectedCustomer.phoneNumber}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedCustomer.email || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Conta Criada em">{getFactor('conta_criada_em') ? new Date(getFactor('conta_criada_em')).toLocaleDateString('pt-MZ') : 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Status Conta">
                <Tag color={getFactor('status_conta') === 'ATIVA' ? 'blue' : 'red'}>{getFactor('status_conta')}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Saldo">
                <Text strong>{getFactor('saldo') ? getFactor('saldo').toLocaleString('pt-MZ') + ' MZN' : 'N/A'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Renda Líquida Mensal">
                <Text strong>{selectedCustomer.salary ? selectedCustomer.salary.toLocaleString('pt-MZ') + ' MZN' : 'N/A'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Salário Domiciliado">
                <Text>{getFactor('salario_domiciliado') ? 'SIM' : 'NÃO'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status Crédito">
                <Tag color={getFactor('status_credito') === 'LIMPO' ? 'green' : 'red'}>{getFactor('status_credito')}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Dívida Total">
                <Text type="danger">{getFactor('divida_total') ? getFactor('divida_total').toLocaleString('pt-MZ') + ' MZN' : '0 MZN'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status PayJA">
                <Tag color={selectedCustomer.status === 'APPROVED' ? 'green' : 'red'}>{selectedCustomer.status === 'APPROVED' ? 'APROVADO' : 'REJEITADO'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Limite PayJA">
                <Text strong style={{ color: selectedCustomer.status === 'APPROVED' ? '#52c41a' : '#ff4d4f' }}>
                  {(selectedCustomer.creditLimit || 0).toLocaleString('pt-MZ')} MZN
                </Text>
              </Descriptions.Item>
            </Descriptions>`;

if (!content.includes('const getFactor')) {
  content = content.replace('return (', factorsExtraction + '\n  return (');
}

content = content.replace(/<Descriptions title="Informações Cadastrais e Financeiras" bordered column=\{2\} size="small">.*?<\/Descriptions>/s, newDescriptions);

fs.writeFileSync(path, content);
console.log('Frontend updated successfully');
