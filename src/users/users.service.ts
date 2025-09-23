import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../auth/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'ASC' | 'DESC';
    search?: string;
  }): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 10);
    const skip = (page - 1) * limit;

    const qb = this.userRepo.createQueryBuilder('user');

    // Filter (search) implementation
    if (query.search) {
      qb.where('user.username ILIKE :search OR user.email ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // Sort implementation
    if (query.sort) {
      const allowedSortFields = ['username', 'email', 'createdAt', 'updatedAt'];
      if (!allowedSortFields.includes(query.sort)) {
        throw new BadRequestException('Invalid sort field');
      }
      qb.orderBy(`user.${query.sort}`, query.order ?? 'ASC');
    } else {
      qb.orderBy('user.createdAt', 'DESC');
    }

    // Pagination
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(id: number, attrs: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    if (attrs.password) {
      attrs.password = await bcrypt.hash(attrs.password, 10);
    }
    Object.assign(user, attrs);
    return this.userRepo.save(user);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['tasks'],
    });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.remove(user);
  }

  async changeRole(id: number, role: UserRole): Promise<User> {
    const user = await this.findOne(id);
    user.role = role;
    return this.userRepo.save(user);
  }
}
