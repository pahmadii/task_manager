import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'newUsername' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 'NewPassword123' })
  @IsString()
  @IsOptional()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])/, {
    message: 'Password must contain both uppercase and lowercase letters',
  })
  password?: string;
}
