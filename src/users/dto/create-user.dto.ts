import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  IsOptional,
  IsArray,
  ArrayUnique,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty() @IsString() username!: string;
  @ApiProperty() @IsString() email!: string;
  @ApiProperty() @IsString() phone!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  roleIds?: number[]; // assign roles on create
}
