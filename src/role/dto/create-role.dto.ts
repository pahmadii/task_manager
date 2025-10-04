import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayUnique } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'ADMIN' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'مدیر کل سیستم', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [Number],
    required: false,
    description: 'permission ids',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  permissionIds?: number[];
}
