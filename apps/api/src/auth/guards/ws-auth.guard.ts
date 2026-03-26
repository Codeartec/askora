import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const auth = client.handshake?.auth;

    if (auth?.token) {
      try {
        const payload = this.jwtService.verify(auth.token);
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (user) {
          client.data = { ...client.data, user, authType: 'jwt' };
          return true;
        }
      } catch {}
    }

    if (auth?.sessionToken) {
      const participant = await this.prisma.participant.findUnique({
        where: { sessionToken: auth.sessionToken },
      });
      if (participant) {
        client.data = { ...client.data, participant, authType: 'session' };
        return true;
      }
    }

    throw new WsException('Unauthorized');
  }
}
