/**
 * USSD Customers API Endpoint
 * 
 * Para usar este código no seu backend Node.js/Express:
 * 1. Copie para src/routes/ussd.routes.js ou similar
 * 2. Integre com seu banco de dados (Prisma, TypeORM, etc)
 * 3. Configure as rotas no seu servidor Express
 */

// ==================== RUTAS PARA CUSTOMERS ====================

// GET /api/ussd/customers - Listar todos os clientes
router.get('/customers', async (req, res) => {
    try {
        // Usar Prisma ou seu ORM para buscar
        const customers = await prisma.customer.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                phoneNumber: true,
                name: true,
                nuit: true,
                dateOfBirth: true,
                address: true,
                district: true,
                province: true,
                verified: true,
                blocked: true,
                createdAt: true,
                updatedAt: true,
                lastAccess: true
            }
        });

        // Calcular estatísticas
        const stats = {
            total: customers.length,
            verified: customers.filter(c => c.verified).length,
            pending: customers.filter(c => !c.verified && !c.blocked).length,
            blocked: customers.filter(c => c.blocked).length
        };

        res.json({
            success: true,
            customers,
            stats
        });
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar clientes'
        });
    }
});

// GET /api/ussd/customers/:phoneNumber - Detalhes de um cliente
router.get('/customers/:phoneNumber', async (req, res) => {
    try {
        const customer = await prisma.customer.findUnique({
            where: { phoneNumber: req.params.phoneNumber },
            include: {
                loans: {
                    orderBy: { createdAt: 'desc' },
                    take: 5 // Últimos 5 empréstimos
                }
            }
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Cliente não encontrado'
            });
        }

        res.json({
            success: true,
            customer
        });
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar cliente'
        });
    }
});

// POST /api/ussd/customers - Criar/Registar cliente (via USSD)
router.post('/customers', async (req, res) => {
    try {
        const {
            phoneNumber,
            name,
            nuit,
            dateOfBirth,
            address,
            district,
            province
        } = req.body;

        // Validação básica
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Número de telefone é obrigatório'
            });
        }

        // Verificar se cliente já existe
        let customer = await prisma.customer.findUnique({
            where: { phoneNumber }
        });

        if (customer) {
            // Atualizar cliente existente
            customer = await prisma.customer.update({
                where: { phoneNumber },
                data: {
                    name: name || customer.name,
                    nuit: nuit || customer.nuit,
                    dateOfBirth: dateOfBirth || customer.dateOfBirth,
                    address: address || customer.address,
                    district: district || customer.district,
                    province: province || customer.province,
                    lastAccess: new Date()
                }
            });

            return res.json({
                success: true,
                customer,
                message: 'Cliente atualizado com sucesso'
            });
        }

        // Criar novo cliente
        customer = await prisma.customer.create({
            data: {
                phoneNumber,
                name,
                nuit,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                address,
                district,
                province
            }
        });

        res.status(201).json({
            success: true,
            customer,
            message: 'Cliente registado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar/atualizar cliente:', error);
        
        // Tratamento de erro de NUIT único
        if (error.code === 'P2002' && error.meta?.target?.includes('nuit')) {
            return res.status(400).json({
                success: false,
                error: 'NUIT já registado no sistema'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erro ao registar cliente'
        });
    }
});

// PUT /api/ussd/customers/:phoneNumber - Atualizar cliente
router.put('/customers/:phoneNumber', async (req, res) => {
    try {
        const updateData = req.body;
        
        // Remover campos que não devem ser alterados
        delete updateData.phoneNumber;
        delete updateData.createdAt;

        const customer = await prisma.customer.update({
            where: { phoneNumber: req.params.phoneNumber },
            data: {
                ...updateData,
                updatedAt: new Date()
            }
        });

        res.json({
            success: true,
            customer,
            message: 'Cliente atualizado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'Cliente não encontrado'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar cliente'
        });
    }
});

// DELETE /api/ussd/customers/:phoneNumber - Deletar cliente
router.delete('/customers/:phoneNumber', async (req, res) => {
    try {
        await prisma.customer.delete({
            where: { phoneNumber: req.params.phoneNumber }
        });

        res.json({
            success: true,
            message: 'Cliente eliminado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao eliminar cliente:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'Cliente não encontrado'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erro ao eliminar cliente'
        });
    }
});

// ==================== EXPORTAR ROTAS ====================
module.exports = router;
