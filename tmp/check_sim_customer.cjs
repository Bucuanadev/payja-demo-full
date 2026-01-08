const Database = require('../ussd-simulator-standalone/src/database.cjs');

async function run(){
  const db = new Database();
  await new Promise(r=>setTimeout(r,500));
  try{
    const customers = await db.getAllCustomers();
    const target = '862345678';
    const found = customers.filter(c => (String(c.msisdn) === target) || (String(c.phoneNumber) === target) || (String(c.phone) === target));
    console.log('TOTAL_CUSTOMERS:', customers.length);
    if(found.length) console.log('FOUND:', JSON.stringify(found,null,2)); else console.log('NOT FOUND:', target);
  }catch(e){
    console.error('ERR',e);
  }finally{
    await db.close();
  }
}
run();
