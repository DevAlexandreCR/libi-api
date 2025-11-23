import prisma from './src/prisma.js'
import bcrypt from 'bcrypt'

async function seed() {
  try {
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10)

    const admin = await prisma.admin.upsert({
      where: { email: 'admin@libi.com' },
      update: {},
      create: {
        email: 'admin@libi.com',
        password: hashedPassword,
      },
    })

    console.log('✅ Admin user created:', admin.email)

    // Create a test business
    const businessPassword = await bcrypt.hash('business123', 10)

    const business = await prisma.business.upsert({
      where: { email: 'business@libi.com' },
      update: {},
      create: {
        email: 'business@libi.com',
        password: businessPassword,
        name: 'Test Restaurant',
      },
    })

    console.log('✅ Business user created:', business.email)

  } catch (error) {
    console.error('Error seeding database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
