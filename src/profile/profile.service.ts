import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as fs from 'fs';
import { join } from 'path';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  async getProfile(userId: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User not found with id: ${userId}`, {
        context: 'ProfileService',
      });
      throw new NotFoundException('User not found');
    }
    this.logger.info(`Fetched profile for user id: ${userId}`, {
      context: 'ProfileService',
    });
    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    const user = await this.getProfile(userId);

    if (dto.email) {
      const exist = await this.userRepo.findOne({
        where: { email: dto.email },
      });
      if (exist && exist.id !== userId) {
        this.logger.error(`Email already in use: ${dto.email}`, {
          context: 'ProfileService',
        });
        throw new BadRequestException('Email already in use');
      }
    }
    if (dto.phone) {
      const exist = await this.userRepo.findOne({
        where: { phone: dto.phone },
      });
      if (exist && exist.id !== userId) {
        this.logger.error(`Phone already in use: ${dto.phone}`, {
          context: 'ProfileService',
        });
        throw new BadRequestException('Phone already in use');
      }
    }

    Object.assign(user, dto);
    const updatedUser = await this.userRepo.save(user);
    this.logger.info(`Profile updated for user id: ${userId}`, {
      context: 'ProfileService',
    });
    return updatedUser;
  }

  async uploadProfileImage(userId: number, filename: string): Promise<User> {
    if (!filename) {
      this.logger.error(
        `Upload failed: filename not provided for user id: ${userId}`,
        { context: 'ProfileService' },
      );
      throw new BadRequestException('Filename is required');
    }

    const user = await this.getProfile(userId);

    if (user.profileImage) {
      const oldPath = join(
        process.cwd(),
        process.env.UPLOAD_PATH || 'Uploads',
        user.profileImage,
      );
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          this.logger.info(`Old profile image deleted for user id: ${userId}`, {
            context: 'ProfileService',
          });
        } catch (err: unknown) {
          if (err instanceof Error) {
            this.logger.error(
              `Failed to delete old profile image for user id: ${userId}. Error: ${err.message}`,
              { context: 'ProfileService' },
            );
          } else {
            this.logger.error(
              `Failed to delete old profile image for user id: ${userId}. Unknown error`,
              { context: 'ProfileService' },
            );
          }

          throw new BadRequestException('Failed to delete old profile image');
        }
      }
    }

    user.profileImage = filename;
    const savedUser = await this.userRepo.save(user);
    this.logger.info(`Profile image uploaded for user id: ${userId}`, {
      context: 'ProfileService',
    });
    return savedUser;
  }
}
