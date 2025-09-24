/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  Query,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  private getUserId(user: { sub?: number; id?: number }): number {
    const userId = user.sub ?? user.id;
    if (userId === undefined) throw new NotFoundException('User ID not found');
    return userId;
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      storage: diskStorage({
        destination: process.env.UPLOAD_PATH || './Uploads',
        filename: (_, file, cb) => {
          const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, name);
        },
      }),
      fileFilter: (_, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPEG, PNG, or PDF files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async create(
    @CurrentUser() user: { sub?: number; id?: number },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateTaskDto,
  ) {
    const userId = this.getUserId(user);
    const filename = file ? file.filename : undefined;
    return this.service.create(userId, dto, filename);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'order', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @CurrentUser() user: { sub?: number; id?: number },
    @Query() query: any,
  ) {
    const userId = this.getUserId(user);
    return this.service.findAll(userId, {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
      sort: query.sort,
      order: query.order,
      search: query.search,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: { sub?: number; id?: number },
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(user);
    return this.service.findOne(userId, +id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_PATH || './Uploads',
        filename: (_, file, cb) => {
          const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, name);
        },
      }),
      fileFilter: (_, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPEG, PNG, or PDF files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async update(
    @CurrentUser() user: { sub?: number; id?: number },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateTaskDto,
  ) {
    const userId = this.getUserId(user);
    const filename = file ? file.filename : undefined;
    return this.service.update(userId, +id, dto, filename);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: { sub?: number; id?: number },
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(user);
    return this.service.remove(userId, +id);
  }

  @Get(':id/attachment')
  async download(
    @CurrentUser() user: { sub?: number; id?: number },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const userId = this.getUserId(user);
    const filename = await this.service.downloadAttachment(userId, +id);
    const filePath = join(
      process.cwd(),
      process.env.UPLOAD_PATH || 'Uploads',
      filename,
    );
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    res.sendFile(filePath);
  }
}
