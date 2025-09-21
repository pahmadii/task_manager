import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../auth/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async findAll(): Promise<User[]> {
    return this.userRepo.find();
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
    await this.userRepo.remove(user); // cascade حذف تسک‌ها
  }

  async changeRole(id: number, role: UserRole): Promise<User> {
    const user = await this.findOne(id);
    user.role = role;
    return this.userRepo.save(user);
  }
}
