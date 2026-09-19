import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@ai-sales-agent/database';

async function seedAdminUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const testEmail = 'admin@enterprise.com';
  const testPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  const existing = await prisma.client.user.findUnique({ where: { email: testEmail } });

  if (existing) {
    await prisma.client.user.update({
      where: { email: testEmail },
      data: { passwordHash, role: UserRole.ADMIN, isActive: true },
    });
    console.log(`Updated test admin password for: ${testEmail}`);
  } else {
    await prisma.client.user.create({
      data: {
        email: testEmail,
        name: 'Lead Admin',
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    console.log(`Created test admin user: ${testEmail}`);
  }

  await app.close();
}

seedAdminUser();
