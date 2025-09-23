import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { User } from '../auth/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { join } from 'path';
import * as fs from 'fs';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async create(
    userId: number,
    dto: CreateTaskDto,
    filename?: string,
  ): Promise<Task> {
    const owner = await this.userRepo.findOne({ where: { id: userId } });
    if (!owner) throw new NotFoundException('Owner not found');

    const task: Task = this.taskRepo.create({
      ...dto,
      owner,
      attachment: filename,
    });
    return this.taskRepo.save(task);
  }

  async findOne(userId: number, id: number): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.owner.id !== userId) throw new ForbiddenException('Access denied');
    return task;
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateTaskDto,
    filename?: string,
  ): Promise<Task> {
    const task = await this.findOne(userId, id);

    if (filename && task.attachment) {
      const oldPath = join(
        process.cwd(),
        process.env.UPLOAD_PATH || 'Uploads',
        task.attachment,
      );
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          throw new BadRequestException('Failed to delete old attachment');
        }
      }
    }

    Object.assign(task, dto);
    if (filename) task.attachment = filename;
    return this.taskRepo.save(task);
  }

  async remove(userId: number, id: number): Promise<void> {
    const task = await this.findOne(userId, id);

    if (task.attachment) {
      const filePath = join(
        process.cwd(),
        process.env.UPLOAD_PATH || 'Uploads',
        task.attachment,
      );
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          throw new BadRequestException('Failed to delete task attachment');
        }
      }
    }

    await this.taskRepo.remove(task);
  }

  async findAll(
    userId: number,
    query: {
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'ASC' | 'DESC';
      search?: string;
    },
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 10);
    const skip = (page - 1) * limit;

    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.owner', 'owner')
      .where('owner.id = :userId', { userId });

    if (query.search) {
      qb.andWhere(
        'task.title ILIKE :search OR task.description ILIKE :search',
        { search: `%${query.search}%` },
      );
    }

    if (query.sort) {
      qb.orderBy(`task.${query.sort}`, query.order ?? 'ASC');
    } else {
      qb.orderBy('task.createdAt', 'DESC');
    }

    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async downloadAttachment(userId: number, id: number): Promise<string> {
    const task = await this.findOne(userId, id);
    if (!task.attachment) throw new NotFoundException('No attachment found');
    return task.attachment;
  }
}
