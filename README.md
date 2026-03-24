# PayJA & Nedbank: Microcrédito Instantâneo via USSD

Este projeto é uma demonstração completa de uma solução de microcrédito instantâneo integrada com o **Nedbank**, permitindo que clientes solicitem e recebam empréstimos em segundos através do canal **USSD (*898#)**.

## 🚀 Visão Geral

O ecossistema PayJA automatiza todo o ciclo de vida do crédito:
1. **Solicitação**: Via USSD (*898#) ou App.
2. **Validação**: Verificação em tempo real com o Banco (Nedbank/Mock).
3. **Scoring**: Avaliação automática de risco e limite.
4. **Desembolso**: Execução instantânea via API bancária.
5. **Notificação**: Confirmação via SMS ao cliente.

## 🛠️ Arquitetura do Sistema

| Serviço | Descrição | Porta |
| :--- | :--- | :--- |
| **PayJA Backend** | Core API (NestJS + Prisma + SQLite) | 3000 |
| **USSD Simulator** | Simulador de Telemóvel e USSD (Express) | 3001 |
| **Banco Mock** | API de Simulação Bancária (Nedbank) | 4500 |
| **PayJA Desktop** | Painel Administrativo (React + Vite) | 5173 |

## 🌐 Acesso Rápido (Demo)

- **Painel Administrativo**: [http://104.207.142.188:5173](http://104.207.142.188:5173)
  - *Credenciais: admin@payja.co.mz / admin123*
- **Simulador USSD**: [http://104.207.142.188:3001](http://104.207.142.188:3001)
- **Banco Mock (Admin)**: [http://104.207.142.188:4100](http://104.207.142.188:4100)
- **API Documentation**: [http://104.207.142.188:3000/api/v1](http://104.207.142.188:3000/api/v1)

---
**Desenvolvido por Bucuanadev**
**Status**: ✅ Online e Funcional
**Última Atualização**: Janeiro 2026
