import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../auth/entities/user.entity';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { Role } from '../role/entities/role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  async createUser(attrs: {
    username: string;
    email: string;
    phone: string;
    password: string;
    roleIds?: number[];
  }): Promise<User> {
    const exist = await this.userRepo.findOne({
      where: [
        { email: attrs.email },
        { username: attrs.username },
        { phone: attrs.phone },
      ],
    });
    if (exist)
      throw new BadRequestException(
        'User with given email/username/phone already exists',
      );

    const hashed = await bcrypt.hash(attrs.password, 10);
    const user = this.userRepo.create({
      username: attrs.username,
      email: attrs.email,
      phone: attrs.phone,
      password: hashed,
      role: UserRole.USER,
    });

    if (attrs.roleIds && attrs.roleIds.length > 0) {
      const roles = await this.roleRepo.findByIds(attrs.roleIds);
      user.roles = roles;
    } else {
      user.roles = [];
    }

    const saved = await this.userRepo.save(user);
    this.logger.info(`Admin created user: ${saved.username}`, {
      context: 'UsersService',
    });
    return saved;
  }

  async assignRoles(userId: number, roleIds: number[]): Promise<User> {
    const user = await this.findOne(userId);
    const roles = await this.roleRepo.findByIds(roleIds);
    if (!roles || roles.length === 0)
      throw new BadRequestException('No valid roles found');
    user.roles = roles;
    const saved = await this.userRepo.save(user);
    this.logger.info(`Assigned roles to user id=${userId}`, {
      context: 'UsersService',
    });
    return saved;
  }

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
        this.logger.error(`Invalid sort field attempted: ${query.sort}`, {
          context: 'UsersService',
        });
        throw new BadRequestException('Invalid sort field');
      }
      qb.orderBy(`user.${query.sort}`, query.order ?? 'ASC');
    } else {
      qb.orderBy('user.createdAt', 'DESC');
    }

    // Pagination
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    this.logger.info(
      `Fetched user list | total: ${total}, page: ${page}, limit: ${limit}`,
      { context: 'UsersService' },
    );
    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      this.logger.error(`User not found: id=${id}`, {
        context: 'UsersService',
      });
      throw new NotFoundException('User not found');
    }
    this.logger.info(`Fetched user: id=${id}`, { context: 'UsersService' });

    return user;
  }

  async updateUser(id: number, attrs: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    if (attrs.password) {
      attrs.password = await bcrypt.hash(attrs.password, 10);
    }
    Object.assign(user, attrs);
    const updatedUser = await this.userRepo.save(user);

    this.logger.info(`Updated user: id=${id}`, { context: 'UsersService' });

    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['tasks'],
    });
    if (!user) {
      this.logger.error(`Delete failed: user not found id=${id}`, {
        context: 'UsersService',
      });
      throw new NotFoundException('User not found');
    }
    await this.userRepo.remove(user);
    this.logger.info(`Deleted user: id=${id}`, { context: 'UsersService' });
  }

  async changeRole(id: number, role: UserRole): Promise<User> {
    const user = await this.findOne(id);
    user.role = role;
    const updatedUser = await this.userRepo.save(user);

    this.logger.info(`Changed role for user: id=${id}, newRole=${role}`, {
      context: 'UsersService',
    } as Record<string, unknown>);

    return updatedUser;
  }
}
