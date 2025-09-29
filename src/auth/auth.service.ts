import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

interface JwtPayload {
  sub: number;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    const exist = await this.userRepo.findOne({
      where: [
        { email: dto.email },
        { username: dto.username },
        { phone: dto.phone },
      ],
    });
    if (exist) {
      this.logger.error(
        `Attempt to register with existing email/username/phone: ${dto.email}, ${dto.username}, ${dto.phone}`,
        { context: 'AuthService' },
      );
      throw new BadRequestException(
        'User with given email, username, or phone already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      ...dto,
      password: hashedPassword,
      role: UserRole.USER,
    });
    const savedUser = await this.userRepo.save(user);
    this.logger.info(`User registered successfully: ${savedUser.username}`, {
      context: 'AuthService',
    });
    return savedUser;
  }

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
      select: ['id', 'username', 'password', 'role'],
    });
    if (!user) {
      this.logger.error(`Login failed: username not found - ${dto.username}`, {
        context: 'AuthService',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      this.logger.error(
        `Login failed: incorrect password for username - ${dto.username}`,
        { context: 'AuthService' },
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    const token: string = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN!,
    });

    this.logger.info(`User logged in successfully: ${user.username}`, {
      context: 'AuthService',
    });

    return { access_token: token };
  }
  async refreshToken(
    userId: number,
    role: UserRole,
  ): Promise<{ access_token: string }> {
    const payload: JwtPayload = { sub: userId, role };
    const newToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN!,
    });

    this.logger.info(`Token refreshed for userId: ${userId}`, {
      context: 'AuthService',
    });

    return { access_token: newToken };
  }

  async logout(): Promise<{ message: string }> {
    this.logger.info(`User logged out`, { context: 'AuthService' });
    return { message: 'Logged out successfully' };
  }
}
