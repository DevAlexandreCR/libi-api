import { PrismaClient, UserRole, WhatsAppLineStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { slug: 'demo-restaurant' },
    update: {},
    create: {
      name: 'Demo Restaurant',
      slug: 'demo-restaurant',
      description: 'Sample merchant for local testing',
      address: '123 Demo Street',
      phone: '+573001112233',
      timezone: 'America/Bogota'
    }
  });

  const passwordHash = await hashPassword('admin123');
  await prisma.user.upsert({
    where: { email: 'admin@libi.local' },
    update: {},
    create: {
      email: 'admin@libi.local',
      passwordHash,
      role: UserRole.SUPER_ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: 'merchant@libi.local' },
    update: {},
    create: {
      email: 'merchant@libi.local',
      passwordHash,
      role: UserRole.MERCHANT_ADMIN,
      merchantId: merchant.id
    }
  });

  await prisma.whatsAppLine.upsert({
    where: { phoneNumberId: 'demo-number-id' },
    update: {},
    create: {
      merchantId: merchant.id,
      phoneNumberId: 'demo-number-id',
      phoneNumber: '+573001112233',
      phoneDisplayName: 'Demo Line',
      status: WhatsAppLineStatus.PENDING_CONFIG
    }
  });

  console.log('Seed data created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
