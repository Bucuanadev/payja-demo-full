
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'prisma/dev.db');
const db = new sqlite3.Database(DB_PATH);

async function createAdmin() {
  const adminEmail = 'admin@payja.mz';
  const adminPassword = 'PayJA@2024';
  const adminName = 'Administrador PayJA';
  const adminRole = 'SUPER_ADMIN';
  const adminId = uuidv4();
  const now = new Date().toISOString();
  
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  return new Promise((resolve, reject) => {
    // Primeiro remover admin existente com mesmo email
    db.run('DELETE FROM admins WHERE email = ?', [adminEmail], (err) => {
      if (err) console.log('Delete error (ok):', err.message);
      
      // Inserir novo admin
      db.run(
        `INSERT INTO admins (id, email, password, name, role, active, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [adminId, adminEmail, hashedPassword, adminName, adminRole, now, now],
        function(err) {
          if (err) {
            console.error('❌ Erro ao criar admin:', err.message);
            reject(err);
          } else {
            console.log('✅ Admin criado com sucesso!');
            console.log('   Email:', adminEmail);
            console.log('   Password:', adminPassword);
            console.log('   Role:', adminRole);
            console.log('   ID:', adminId);
            
            // Verificar
            db.get('SELECT id, email, name, role, active FROM admins WHERE email = ?', [adminEmail], (err, row) => {
              if (row) {
                console.log('\n✅ Verificação OK:', JSON.stringify(row));
              }
              db.close();
              resolve(row);
            });
          }
        }
      );
    });
  });
}

createAdmin().catch(console.error);
