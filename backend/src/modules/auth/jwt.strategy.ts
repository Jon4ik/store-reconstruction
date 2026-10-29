import { normalizePermissions } from './permission-model';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma.service';
import { getJwtSecret } from '../../config/security';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    if (!payload?.sub || !Number.isInteger(payload.ver)) throw new UnauthorizedException('Недействительная сессия');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, isActive: true, tokenVersion: true, roleId: true, role: { select: { permissions: true } } },
    });
    if (!user || !user.isActive || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Сессия отозвана или учётная запись отключена');
    }
    return {
      sub: user.id,
      username: user.username,
      role: user.roleId,
      permissions: normalizePermissions(user.role.permissions),
    };
  }
}
