(async ()=>{
  try{
    const payjaUrl = process.env.PAYJA_URL || 'http://155.138.227.26:3000/api/v1/integrations/ussd/customers';
    const simUrl = process.env.SIM_URL || 'http://155.138.227.26:3001/api/customers';

    const pResp = await (await fetch(payjaUrl)).json();
    const sResp = await (await fetch(simUrl)).json();

    function extractPhones(obj){
      if(!obj) return [];
      if(Array.isArray(obj)){
        return obj.map(x=>x.phoneNumber||x.msisdn||x.phoneNumber||x.phone||x.phone_number).filter(Boolean);
      }
      if(obj.customers) return extractPhones(obj.customers);
      if(obj.data) return extractPhones(obj.data);
      return [];
    }

    const payPhones = Array.from(new Set(extractPhones(pResp).map(x=>String(x).trim()))).sort();
    const simPhones = Array.from(new Set(extractPhones(sResp.customers||sResp).map(x=>String(x).trim()))).sort();

    console.log('PAYJA_COUNT:', payPhones.length);
    console.log('SIM_COUNT:', simPhones.length);

    const missing = payPhones.filter(x=>!simPhones.includes(x));
    if(missing.length===0){
      console.log('ALL_PAYJA_PRESENT_IN_SIMULATOR: true');
    } else {
      console.log('ALL_PAYJA_PRESENT_IN_SIMULATOR: false');
      console.log('MISSING_IN_SIM:');
      missing.forEach(m=>console.log(' -', m));
    }

    const extra = simPhones.filter(x=>!payPhones.includes(x));
    if(extra.length>0){
      console.log('EXTRA_IN_SIM:');
      extra.forEach(e=>console.log(' -', e));
    }

  }catch(e){
    console.error('ERROR:', e.message||e);
    process.exit(2);
  }
})();
