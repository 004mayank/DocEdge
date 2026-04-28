import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env';

export type AuthUser = { userId: string; clinicId: string; role: string };

declare global {
  // eslint-disable-next-line no-var
  var __docedge_auth_user: AuthUser | undefined;
}

@Injectable()
export class JwtGuard implements CanActivate {
  private env = loadEnv();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth?.startsWith('Bearer '))
      throw new UnauthorizedException('Missing token');
    const token = auth.slice('Bearer '.length);

    try {
      const payload = jwt.verify(token, this.env.JWT_SECRET) as AuthUser;
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
