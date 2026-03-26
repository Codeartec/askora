import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req?.headers?.authorization;

    // Allow anonymous requests when no Authorization header is present.
    if (!authHeader) return true;

    // If present, enforce normal JWT validation (401 on invalid token).
    return (await super.canActivate(context)) as boolean;
  }
}

