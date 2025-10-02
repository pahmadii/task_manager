import 'dotenv/config';
import dataSource from './../data-source';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { Task } from '../src/tasks/entities/task.entity';
import { Permission } from '../src/iam/entities/permission.entity';
import * as bcrypt from 'bcryptjs';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

const requiredEnvVars = [
  'ADMIN_USERNAME',
  'ADMIN_EMAIL',
  'ADMIN_PHONE',
  'ADMIN_PASSWORD',
];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

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
    const permissionRepo = dataSource.getRepository(Permission);

    const existingAdmin = await userRepo.findOne({
      where: { username: process.env.ADMIN_USERNAME! },
    });

    let savedAdmin: User;
    if (!existingAdmin) {
      const hashedPass = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10);
      const admin = userRepo.create({
        username: process.env.ADMIN_USERNAME!,
        email: process.env.ADMIN_EMAIL!,
        phone: process.env.ADMIN_PHONE!,
        password: hashedPass,
        role: UserRole.ADMIN,
      });

      savedAdmin = await userRepo.save(admin);
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
      savedAdmin = existingAdmin;

      logger.warn('Admin user already exists, skipping seeding', 'Seed');
    }
    const permissionList: { name: string; description?: string }[] = [
      // auth
      { name: 'auth:register', description: 'ثبت‌نام کاربر' },
      { name: 'auth:login', description: 'ورود کاربر' },
      { name: 'auth:refresh', description: 'رفرش توکن' },
      { name: 'auth:logout', description: 'خروج کاربر' },

      // users (admin)
      { name: 'user:list', description: 'لیست کاربران' },
      { name: 'user:store', description: 'ساخت کاربر' },
      { name: 'user:read', description: 'خواندن اطلاعات یک کاربر' },
      { name: 'user:update', description: 'ویرایش کاربر' },
      { name: 'user:delete', description: 'حذف کاربر' },
      { name: 'user:changeRole', description: 'تغییر نقش کاربر' },

      // profile (own)
      { name: 'profile:read', description: 'مشاهده پروفایل خود' },
      { name: 'profile:update', description: 'ویرایش پروفایل خود' },
      { name: 'profile:upload', description: 'آپلود تصویر پروفایل' },
      { name: 'profile:avatar', description: 'دریافت تصویر پروفایل' },

      // tasks
      { name: 'task:list', description: 'لیست تسک‌های خود' },
      { name: 'task:store', description: 'ایجاد تسک' },
      { name: 'task:read', description: 'مشاهده تسک (فقط مالک)' },
      { name: 'task:update', description: 'ویرایش تسک (فقط مالک)' },
      { name: 'task:delete', description: 'حذف تسک (فقط مالک)' },
      { name: 'task:attachment', description: 'دریافت پیوست تسک' },
    ];

    for (const p of permissionList) {
      const existing = await permissionRepo.findOne({
        where: { name: p.name },
      });
      if (!existing) {
        const created = permissionRepo.create({
          name: p.name,
          description: p.description ?? null,
        });
        await permissionRepo.save(created);
        logger.log(`Permission created: ${p.name}`, 'Seed');
      } else {
        logger.log(`Permission exists: ${p.name}`, 'Seed');
      }
    }

    logger.log('Permission seeding completed', 'Seed');
  } catch (err) {
    logger.error('Seeding failed', err, 'Seed');
  } finally {
    await dataSource.destroy();
    logger.log('Seeding completed and connection closed', 'Seed');
    await appContext.close();
  }
}

runSeed();
