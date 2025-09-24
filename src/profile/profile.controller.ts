import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  Body,
  UseInterceptors,
  UploadedFile,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiTags } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import * as fs from 'fs';

@ApiTags('profile')
@Controller('profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class ProfileController {
  constructor(private service: ProfileService) {}

  private getUserId(user: { sub?: number; id?: number }): number {
    const userId = user.sub ?? user.id;
    if (userId === undefined) {
      throw new BadRequestException('User ID not found');
    }
    return userId;
  }

  @Get()
  async me(@CurrentUser() user: { sub?: number; id?: number }) {
    const userId = this.getUserId(user);
    return this.service.getProfile(userId);
  }

  @Patch()
  async update(
    @CurrentUser() user: { sub?: number; id?: number },
    @Body() dto: UpdateProfileDto,
  ) {
    const userId = this.getUserId(user);
    return this.service.updateProfile(userId, dto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_PATH || './Uploads',
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname as string)}`;
          cb(null, name);
        },
      }),
      fileFilter: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPEG or PNG files are allowed'),
            false,
          );
        }
        cb(null, true);
      },

      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async upload(
    @CurrentUser() user: { sub?: number; id?: number },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const userId = this.getUserId(user);
    return this.service.uploadProfileImage(userId, file.filename);
  }

  @Get('avatar/:filename')
  download(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(
      process.cwd(),
      process.env.UPLOAD_PATH || 'Uploads',
      filename,
    );
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    return res.sendFile(filePath);
  }
}
