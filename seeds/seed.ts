import 'dotenv/config';
import dataSource from './../data-source';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { Task } from '../src/tasks/entities/task.entity';
import * as bcrypt from 'bcryptjs';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function runSeed() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const logger = appContext.get<Logger>(WINSTON_MODULE_NEST_PROVIDER);

  try {
    await dataSource.initialize();
    logger.log(' Database connected for seeding', 'Seed');

    const userRepo = dataSource.getRepository(User);
    const taskRepo = dataSource.getRepository(Task);

    const existingAdmin = await userRepo.findOne({
      where: { username: process.env.ADMIN_USERNAME! },
    });

    if (!existingAdmin) {
      const hashedPass = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10);
      const admin = userRepo.create({
        username: process.env.ADMIN_USERNAME!,
        email: process.env.ADMIN_EMAIL!,
        phone: process.env.ADMIN_PHONE!,
        password: hashedPass,
        role: UserRole.ADMIN,
      });

      const savedAdmin = await userRepo.save(admin);
      logger.log(`Admin user created: ${savedAdmin.username}`, 'Seed');

      const tasks = taskRepo.create([
        {
          title: 'اولین تسک',
          description: 'این یک تسک نمونه است',
          owner: savedAdmin,
        },
        {
          title: 'تسک دوم',
          description: 'یک تسک دیگر برای تست',
          owner: savedAdmin,
        },
      ]);
      await taskRepo.save(tasks);
      logger.log('Sample tasks created for admin', 'Seed');
    } else {
      logger.warn('Admin user already exists, skipping seeding', 'Seed');
    }
  } catch (err) {
    logger.error('Seeding failed', err, 'Seed');
  } finally {
    await dataSource.destroy();
    logger.log('Seeding completed and connection closed', 'Seed');
    await appContext.close();
  }
}

runSeed();
