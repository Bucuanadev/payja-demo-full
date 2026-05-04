
const bcrypt = require('bcrypt');
bcrypt.hash('PayJA@2024', 10).then(hash => {
  console.log(hash);
}).catch(err => {
  console.error(err);
});
