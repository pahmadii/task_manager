import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class ProfileService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async getProfile(userId: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    const user = await this.getProfile(userId);

    if (dto.email) {
      const exist = await this.userRepo.findOne({
        where: { email: dto.email },
      });
      if (exist && exist.id !== userId)
        throw new BadRequestException('Email already in use');
    }
    if (dto.phone) {
      const exist = await this.userRepo.findOne({
        where: { phone: dto.phone },
      });
      if (exist && exist.id !== userId)
        throw new BadRequestException('Phone already in use');
    }

    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async uploadProfileImage(userId: number, filename: string): Promise<User> {
    if (!filename) throw new BadRequestException('Filename is required');

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
        } catch (err) {
          throw new BadRequestException('Failed to delete old profile image');
        }
      }
    }

    user.profileImage = filename;
    return this.userRepo.save(user);
  }
}
