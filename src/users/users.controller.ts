import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@ApiTags('users')
@ApiBearerAuth('jwt')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  getAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(+id, dto);
  }

  @Patch(':id/role')
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.usersService.changeRole(+id, dto.role);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.usersService.deleteUser(+id);
  }
}
