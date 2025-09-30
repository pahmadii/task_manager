import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { User } from '../auth/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { join } from 'path';
import * as fs from 'fs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  async create(
    userId: number,
    dto: CreateTaskDto,
    filename?: string,
  ): Promise<Task> {
    const owner = await this.userRepo.findOne({ where: { id: userId } });
    if (!owner) {
      this.logger.error(
        `Task creation failed: owner not found - userId: ${userId}`,
        { context: 'TasksService' },
      );
      throw new NotFoundException('Owner not found');
    }

    const task: Task = this.taskRepo.create({
      ...dto,
      owner,
      attachment: filename,
    });
    const savedTask = await this.taskRepo.save(task);
    this.logger.info(
      `Task created successfully: ${task.title}, userId: ${userId}`,
      { context: 'TasksService' },
    );
    return savedTask;
  }

  async findOne(userId: number, id: number): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!task) {
      this.logger.error(`Task not found: taskId: ${id}`, {
        context: 'TasksService',
      });
      throw new NotFoundException('Task not found');
    }
    if (task.owner.id !== userId) {
      this.logger.error(`Access denied for taskId: ${id}, userId: ${userId}`, {
        context: 'TasksService',
      });
      throw new ForbiddenException('Access denied');
    }
    this.logger.info(`Task fetched: taskId: ${id}, userId: ${userId}`, {
      context: 'TasksService',
    });
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
          this.logger.info(`Old attachment deleted for taskId: ${id}`, {
            context: 'TasksService',
          });
        } catch (err: unknown) {
          if (err instanceof Error) {
            this.logger.error(
              `Failed to delete old attachment for taskId: ${id}. Error: ${err.message}`,
              { context: 'TasksService' },
            );
          } else {
            this.logger.error(
              `Failed to delete old attachment for taskId: ${id}. Unknown error`,
              { context: 'TasksService' },
            );
          }
          throw new BadRequestException('Failed to delete old attachment');
        }
      }
    }

    Object.assign(task, dto);
    if (filename) task.attachment = filename;
    const updatedTask = await this.taskRepo.save(task);
    this.logger.info(`Task updated: taskId: ${id}, userId: ${userId}`, {
      context: 'TasksService',
    });
    return updatedTask;
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
          this.logger.info(`Attachment deleted for taskId: ${id}`, {
            context: 'TasksService',
          });
        } catch (err: unknown) {
          if (err instanceof Error) {
            this.logger.error(
              `Failed to delete old attachment for taskId: ${id}. Error: ${err.message}`,
              { context: 'TasksService' },
            );
          } else {
            this.logger.error(
              `Failed to delete old attachment for taskId: ${id}. Unknown error`,
              { context: 'TasksService' },
            );
          }
          throw new BadRequestException('Failed to delete old attachment');
        }
      }
    }

    await this.taskRepo.remove(task);
    this.logger.info(`Task removed: taskId: ${id}, userId: ${userId}`, {
      context: 'TasksService',
    });
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
    this.logger.info(`Fetched task list for userId: ${userId}, page: ${page}`, {
      context: 'TasksService',
    });

    return { data, total, page, limit };
  }

  async downloadAttachment(userId: number, id: number): Promise<string> {
    const task = await this.findOne(userId, id);
    if (!task.attachment) {
      this.logger.error(`No attachment found for taskId: ${id}`, {
        context: 'TasksService',
      });
      throw new NotFoundException('No attachment found');
    }
    this.logger.info(`Attachment fetched for taskId: ${id}`, {
      context: 'TasksService',
    });

    return task.attachment;
  }
}
