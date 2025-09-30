import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import Redis from 'ioredis';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const can = await super.canActivate(context);
    if (!can) return false;

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    const token =
      typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined;

    if (!token) throw new UnauthorizedException();

    const isRevoked = await this.redisClient.get(`blacklist:${token}`);
    if (isRevoked) throw new UnauthorizedException('Token revoked');

    return true;
  }
}
