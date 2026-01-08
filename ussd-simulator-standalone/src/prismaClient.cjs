const path = require('path');
// Ensure Prisma uses the same SQLite file as the simulator server (backend/prisma/dev.db)
const dbFile = path.resolve(__dirname, '../../backend/prisma/dev.db').replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${dbFile}`;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
