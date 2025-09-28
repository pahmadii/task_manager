import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/entities/user.entity';
import { IsEnum } from 'class-validator';

export class ChangeRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  @IsEnum(UserRole)
  role!: UserRole;
}
