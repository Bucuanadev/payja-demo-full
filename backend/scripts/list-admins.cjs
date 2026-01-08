const { PrismaClient } = require('@prisma/client');
(async ()=>{
  const prisma = new PrismaClient();
  try{
    const admins = await prisma.admin.findMany();
    console.log('Admins:', admins.map(a=>({id:a.id,email:a.email,active:a.active}))); 
  }catch(e){console.error(e)}finally{await prisma.$disconnect();}
})();