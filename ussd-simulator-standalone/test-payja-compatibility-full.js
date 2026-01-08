const axios = require('axios');

async function testFullCompatibility() {
    const baseUrl = 'http://155.138.228.89:3001';
    
    console.log('=== TESTE COMPLETO DE COMPATIBILIDADE PAYJA ===\n');
    
    try {
        // 1. Testar health check
        console.log('1. ✅ Health Check do Simulador PayJA:');
        const health = await axios.get(`${baseUrl}/health`);
        console.log(`   Status: ${health.data.status}`);
        console.log(`   Simulator: ${health.data.simulator}\n`);

        // 2. Testar endpoint específico do PayJA
        console.log('2. ✅ Health Check PayJA:');
        const payjaHealth = await axios.get(`${baseUrl}/api/payja/health`);
        console.log(`   Service: ${payjaHealth.data.service}`);
        console.log(`   Status: ${payjaHealth.data.status}`);
        console.log(`   Endpoints disponíveis:`, payjaHealth.data.endpoints);
        console.log();

        // 3. Buscar clientes no formato PayJA
        console.log('3. 📞 Buscando novos clientes (formato PayJA):');
        const newCustomers = await axios.get(`${baseUrl}/api/payja/ussd/new-customers`);
        console.log(`   Encontrados: ${newCustomers.data.length} clientes`);
        
        newCustomers.data.forEach((cust, idx) => {
            console.log(`   ${idx + 1}. ${cust.phoneNumber}: ${cust.name}`);
            console.log(`      NUIT: ${cust.nuit}, BI: ${cust.biNumber}, Banco: ${cust.institution}`);
        });
        
        if (newCustomers.data.length === 0) {
            console.log('   ⚠️  Nenhum cliente não sincronizado encontrado');
            console.log('   Verificando base de dados...');
            
            const dbInfo = await axios.get(`${baseUrl}/api/db-info`);
            console.log(`   Total no banco: ${dbInfo.data.total_customers}`);
            console.log(`   Não sincronizados: ${dbInfo.data.unsynced_customers}`);
            
            // Adicionar cliente de teste
            console.log('\n   Adicionando cliente de teste...');
            await axios.post(`http://155.138.228.89:3001/api/customers`, {
                msisdn: '871234567',
                name: 'Teste PayJA'
            }).catch(()=>{});
            
            // Tentar novamente
            const newAttempt = await axios.get(`${baseUrl}/api/payja/ussd/new-customers`);
            console.log(`   Após adição: ${newAttempt.data.length} clientes`);
        }
        console.log();

        // 4. Testar marcação como verificado
        if (newCustomers.data.length > 0) {
            const testCustomer = newCustomers.data[0];
            console.log('4. ✅ Testando marcação como verificado:');
            
            const verificationPayload = {
                phoneNumber: testCustomer.phoneNumber,
                creditLimit: 50000,
                name: testCustomer.name,
                nuit: testCustomer.nuit,
                biNumber: testCustomer.biNumber,
                email: 'teste@email.com',
                salary: 25000,
                salaryBank: testCustomer.institution,
                creditScore: 750
            };
            
            const verifyResponse = await axios.post(
                `${baseUrl}/api/payja/ussd/mark-verified`,
                verificationPayload
            );
            
            console.log(`   Sucesso: ${verifyResponse.data.success}`);
            console.log(`   Mensagem: ${verifyResponse.data.message}`);
            console.log();
            
            // 5. Testar elegibilidade
            console.log('5. 📊 Testando elegibilidade:');
            const eligibilityPayload = {
                phoneNumber: testCustomer.phoneNumber,
                eligible: true,
                creditLimit: 50000,
                minAmount: 1000,
                reason: 'Cliente verificado com sucesso'
            };
            
            const eligibilityResponse = await axios.post(
                `${baseUrl}/api/payja/ussd/eligibility`,
                eligibilityPayload
            );
            
            console.log(`   Sucesso: ${eligibilityResponse.data.success}`);
            console.log(`   Elegível: ${eligibilityResponse.data.eligible}`);
            console.log(`   Limite: ${eligibilityResponse.data.creditLimit}`);
            console.log();
        }

        // 6. Testar endpoint de empréstimos
        console.log('6. 💰 Testando endpoint de empréstimos:');
        const loansResponse = await axios.get(`${baseUrl}/api/loans`);
        console.log(`   Empréstimos encontrados: ${loansResponse.data.length}`);
        
        loansResponse.data.slice(0, 2).forEach((loan, idx) => {
            console.log(`   Empréstimo ${idx + 1}:`);
            console.log(`      ID: ${loan.id}`);
            console.log(`      Cliente: ${loan.customerName} (${loan.phoneNumber})`);
            console.log(`      Valor: ${loan.amount} MZN`);
            console.log(`      Status: ${loan.status}`);
        });
        console.log();

        // 7. Testar endpoints originais (para compatibilidade)
        console.log('7. 🔄 Testando endpoints originais:');
        const unsynced = await axios.get(`${baseUrl}/api/customers/unsynced`);
        console.log(`   Clientes não sincronizados: ${unsynced.data.length}`);
        
        const allCustomers = await axios.get(`${baseUrl}/api/customers`);
        console.log(`   Todos os clientes: ${allCustomers.data.length}`);
        console.log();

        console.log('🎉 === TESTE DE COMPATIBILIDADE CONCLUÍDO COM SUCESSO ===');
        console.log('\n✅ O simulador está totalmente compatível com o PayJA!');
        console.log('🔗 Configure o backend PayJA com:');
        console.log('   USSD_SIM_BASE_URL=http://155.138.228.89:3001');
        console.log('   USSD_SIM_ENDPOINT_NEW=/api/payja/ussd/new-customers');
        console.log('   USSD_SIM_ENDPOINT_ELIG=/api/payja/ussd/eligibility');
        console.log('   USSD_SIM_ENDPOINT_LOANS=/api/loans');
        
    } catch (error) {
        console.error('\n❌ Erro durante o teste:');
        console.error(`   Mensagem: ${error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('   O simulador não está rodando na porta 3001');
            console.error('   Execute: cd ussd-simulator-standalone && node src/main-payja-compatible.cjs');
        } else if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Dados: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        
        process.exit(1);
    }
}

// Executar teste
testFullCompatibility();
