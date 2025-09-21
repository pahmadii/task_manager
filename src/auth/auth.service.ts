import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

interface JwtPayload {
  sub: number;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService, // Inject JwtService
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    const exist = await this.userRepo.findOne({
      where: [
        { email: dto.email },
        { username: dto.username },
        { phone: dto.phone },
      ],
    });
    if (exist)
      throw new BadRequestException(
        'User with given email, username, or phone already exists',
      );

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      ...dto,
      password: hashedPassword,
      role: UserRole.USER,
    });
    return this.userRepo.save(user);
  }

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
      select: ['id', 'username', 'password', 'role'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = { sub: user.id, role: user.role };
    const token: string = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    return { access_token: token };
  }
}
