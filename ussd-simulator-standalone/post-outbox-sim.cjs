const http = require('http');
const data = JSON.stringify({
  phoneNumber: '258700112233',
  name: 'Sim Teste Browser',
  nuit: '200000111',
  biNumber: 'BI1234567',
  institution: 'Banco BIM',
  createdAt: new Date().toISOString(),
  status: 'registered',
  verified: false
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/customers/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', body);
  });
});

req.on('error', (e) => console.error('REQ ERR', e));
req.write(data);
req.end();
