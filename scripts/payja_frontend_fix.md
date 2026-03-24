# Correções para PayJA Frontend

Para garantir a paridade total com o Banco GHW, o componente de Dossiê do PayJA deve ser atualizado para exibir todos os campos do Banco GHW.

## 1. Atualização do Componente de Dossiê (ex: src/components/CustomerDossier.tsx)
Substitua a secção de "Informações Cadastrais e Financeiras" pelo seguinte código:

```tsx
// No componente que exibe o Dossiê (ex: CustomerDossier.tsx)
<div className="dossier-info-grid">
  <div className="dossier-row">
    <div className="dossier-field">
      <span className="field-label">Nome Completo</span>
      <span className="field-value">{customer.name}</span>
    </div>
  </div>
  
  <div className="dossier-row">
    <div className="dossier-field">
      <span className="field-label">NUIT</span>
      <span className="field-value">{customer.nuit}</span>
    </div>
    <div className="dossier-field">
      <span className="field-label">BI</span>
      <span className="field-value">{customer.biNumber}</span>
    </div>
  </div>

  <div className="dossier-row">
    <div className="dossier-field">
      <span className="field-label">Validade do B.I.</span>
      <span className="field-value">{formatDate(customer.biExpiryDate)}</span>
    </div>
    <div className="dossier-field">
      <span className="field-label">Telefone</span>
      <span className="field-value">{customer.phoneNumber}</span>
    </div>
  </div>

  <div className="dossier-row">
    <div className="dossier-field">
      <span className="field-label">Email</span>
      <span className="field-value">{customer.email}</span>
    </div>
    <div className="dossier-field">
      <span className="field-label">Conta Criada em</span>
      <span className="field-value">{formatDate(customer.accountCreatedAt)}</span>
    </div>
  </div>

  <div className="dossier-row">
    <div className="dossier-field">
      <span className="field-label">Status Conta</span>
      <span className={`status-badge ${customer.accountStatus === 'ATIVA' ? 'active' : 'inactive'}`}>
        {customer.accountStatus}
      </span>
    </div>
    <div className="dossier-field">
      <span className="field-label">Saldo</span>
      <span className="field-value">{formatCurrency(customer.currentBalance)} MZN</span>
    </div>
  </div>

  <div className="dossier-row">
    <div className="dossier-field">
      <span className="field-label">Renda Mensal</span>
      <span className="field-value">{formatCurrency(customer.salary)} MZN</span>
    </div>
    <div className="dossier-field">
      <span className="field-label">Salário Domiciliado</span>
      <span className="field-value">{customer.isSalaryDomiciled ? 'SIM' : 'NÃO'}</span>
    </div>
  </div>

  <div className="dossier-row">
    <div className="dossier-field">
      <span className="field-label">Status Crédito</span>
      <span className={`credit-status ${customer.creditStatus === 'LIMPO' ? 'clean' : 'bad'}`}>
        {customer.creditStatus}
      </span>
    </div>
    <div className="dossier-field">
      <span className="field-label">Dívida Total</span>
      <span className="field-value">{formatCurrency(customer.totalDebt)} MZN</span>
    </div>
  </div>

  <div className="dossier-row">
    <div className="dossier-field">
      <span className="field-label">Status PayJA</span>
      <span className={`payja-status ${customer.status === 'APPROVED' ? 'approved' : 'rejected'}`}>
        {customer.status === 'APPROVED' ? 'APROVADO' : 'REJEITADO'}
      </span>
    </div>
    <div className="dossier-field">
      <span className="field-label">Limite PayJA</span>
      <span className="field-value">{formatCurrency(customer.creditLimit)} MZN</span>
    </div>
  </div>
</div>
```
