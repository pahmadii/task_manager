import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Repository } from 'typeorm';
import { Permission } from '../iam/entities/permission.entity';
import { In } from 'typeorm';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
  ) {}

  async create(payload: {
    name: string;
    description?: string;
    permissionIds?: number[];
  }) {
    const { name, description, permissionIds } = payload;
    const exists = await this.roleRepo.findOne({ where: { name } });
    if (exists)
      throw new BadRequestException('Role with that name already exists');

    const role = this.roleRepo.create({ name, description });

    if (permissionIds && permissionIds.length > 0) {
      const perms = await this.permRepo.findBy({ id: In(permissionIds) });
      role.permissions = perms;
    } else {
      role.permissions = [];
    }

    return this.roleRepo.save(role);
  }

  async findAll() {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number) {
    const r = await this.roleRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Role not found');
    return r;
  }

  async update(
    id: number,
    payload: { name?: string; description?: string; permissionIds?: number[] },
  ) {
    const role = await this.findOne(id);
    if (payload.name) role.name = payload.name;
    if (payload.description !== undefined)
      role.description = payload.description;

    if (payload.permissionIds) {
      const perms = await this.permRepo.findBy({
        id: In(payload.permissionIds),
      });
      role.permissions = perms;
    }

    return this.roleRepo.save(role);
  }

  async remove(id: number) {
    const role = await this.findOne(id);
    return this.roleRepo.remove(role);
  }
}
