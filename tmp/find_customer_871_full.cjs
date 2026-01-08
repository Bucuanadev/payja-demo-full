const Database = require('../ussd-simulator-standalone/src/database.cjs');

async function run(){
  const db = new Database();
  await new Promise(r=>setTimeout(r,500));
  try{
    const customers = await db.getAllCustomers();
    const targetPhone = '871234567';
    const targetNuit = '100234567';
    const targetName = 'João Pedro da Silva';
    const found = customers.filter(c => {
      const name = c.name || '';
      return String(c.msisdn) === targetPhone || String(c.phoneNumber) === targetPhone || String(c.nuit) === targetNuit || name.includes(targetName);
    });
    console.log('TOTAL_CUSTOMERS:', customers.length);
    if(found.length) console.log('FOUND:', JSON.stringify(found,null,2)); else console.log('NOT FOUND: any matching record for phone/nuit/name');
  }catch(e){
    console.error('ERR',e);
  }finally{
    await db.close();
  }
}
run();
