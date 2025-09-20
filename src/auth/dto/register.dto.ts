import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString() @IsNotEmpty() username: string;
  @IsEmail() @IsNotEmpty() email: string;
  @IsString() @IsNotEmpty() phone: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])/, {
    message: 'Password must contain both uppercase and lowercase letters',
  })
  password: string;
}
