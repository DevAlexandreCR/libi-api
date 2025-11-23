const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt')

async function createTestUser() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'libi'
  })

  try {
    const hashedPassword = await bcrypt.hash('business123', 10)

    // Create business user
    await connection.execute(
      'INSERT INTO Business (id, email, password, name, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, NOW(), NOW())',
      ['business@libi.com', hashedPassword, 'Test Restaurant']
    )

    console.log('✅ Business user created: business@libi.com / business123')

    // Create admin user
    const adminHash = await bcrypt.hash('admin123', 10)
    await connection.execute(
      'INSERT INTO Admin (id, email, password, createdAt, updatedAt) VALUES (UUID(), ?, ?, NOW(), NOW())',
      ['admin@libi.com', adminHash]
    )

    console.log('✅ Admin user created: admin@libi.com / admin123')

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('ℹ️  Users already exist')
    } else {
      console.error('Error:', error.message)
    }
  } finally {
    await connection.end()
  }
}

createTestUser()
