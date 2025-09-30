import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import Redis from 'ioredis';
import { Request } from 'express';

interface JwtPayload {
  sub: number;
  role: UserRole;
}

interface JwtRequestUser {
  id: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...rest } = user;
    return rest;
  }

  async register(dto: RegisterDto): Promise<Omit<User, 'password'>> {
    try {
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

      return this.sanitizeUser(savedUser);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error(
        `Unexpected error during registration: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { context: 'AuthService' },
      );
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async login(
    dto: LoginDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
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
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    });

    try {
      await this.redisClient.set(
        `refresh:${user.id}`,
        refreshToken,
        'EX',
        7 * 24 * 60 * 60,
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to set refresh token in Redis for user ${user.id}: ${error.message}`,
          { context: 'AuthService' },
        );
      } else {
        this.logger.error(
          `Failed to set refresh token in Redis for user ${user.id}: ${String(error)}`,
          { context: 'AuthService' },
        );
      }
      throw new Error('Failed to set refresh token in Redis');
    }

    this.logger.info(`User logged in successfully: ${user.username}`, {
      context: 'AuthService',
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      if (this.redisClient.status !== 'ready') {
        this.logger.error('Redis client is not connected', {
          context: 'AuthService',
        });
        throw new Error('Redis client is not connected');
      }

      const storedToken = await this.redisClient.get(`refresh:${payload.sub}`);
      if (!storedToken || storedToken !== refreshToken) {
        this.logger.error(`Invalid refresh token for user ${payload.sub}`, {
          context: 'AuthService',
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newAccessToken = this.jwtService.sign(
        { sub: payload.sub, role: payload.role },
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '1h' },
      );

      const newRefreshToken = this.jwtService.sign(
        { sub: payload.sub, role: payload.role },
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' },
      );

      await this.redisClient.set(
        `refresh:${payload.sub}`,
        newRefreshToken,
        'EX',
        7 * 24 * 60 * 60,
      );
      return { access_token: newAccessToken, refresh_token: newRefreshToken };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Refresh token error: ${error.message}`, {
          context: 'AuthService',
        });
      } else {
        this.logger.error(`Refresh token error: ${String(error)}`, {
          context: 'AuthService',
        });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(
    req: Request & { user: JwtRequestUser },
  ): Promise<{ message: string }> {
    const userId = Number(req.user.id);

    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Access token not provided');
    }

    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
      throw new UnauthorizedException('Access token not provided');
    }

    await this.redisClient.del(`refresh:${userId}`);

    await this.redisClient.set(
      `blacklist:${accessToken}`,
      'revoked',
      'EX',
      60 * 60,
    );

    return { message: 'Logged out successfully' };
  }
}
