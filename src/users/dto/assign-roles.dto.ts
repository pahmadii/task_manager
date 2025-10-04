import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayUnique } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayUnique()
  roleIds!: number[];
}
