import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './src/auth/entities/user.entity';
import { Task } from './src/tasks/entities/task.entity';
import { Permission } from './src/iam/entities/permission.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [Task, User, Permission],
  migrations: ['migrations/*.ts'],
  synchronize: false,
});
