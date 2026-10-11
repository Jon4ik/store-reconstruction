import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma.service';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

@Injectable()
export class AuthService {
  private readonly failedLogins = new Map<string, { count: number; firstAt: number }>();

  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  private assertLoginAllowed(username: string) {
    const key = username.trim().toLowerCase().slice(0, 64);
    const current = this.failedLogins.get(key);
    if (!current) return key;
    if (Date.now() - current.firstAt >= WINDOW_MS) {
      this.failedLogins.delete(key);
      return key;
    }
    if (current.count >= MAX_FAILURES) throw new HttpException('Слишком много неудачных попыток. Повторите через 15 минут.', HttpStatus.TOO_MANY_REQUESTS);
    return key;
  }

  private recordFailure(key: string) {
    const now = Date.now();
    for (const [storedKey, entry] of this.failedLogins) {
      if (now - entry.firstAt >= WINDOW_MS) this.failedLogins.delete(storedKey);
    }
    if (this.failedLogins.size >= 10000 && !this.failedLogins.has(key)) {
      const oldestKey = this.failedLogins.keys().next().value;
      if (oldestKey) this.failedLogins.delete(oldestKey);
    }
    const current = this.failedLogins.get(key);
    if (!current || now - current.firstAt >= WINDOW_MS) {
      this.failedLogins.set(key, { count: 1, firstAt: now });
    } else {
      current.count += 1;
    }
  }

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username }, include: { role: true } });
    // Keep the external response identical for unknown users and bad passwords.
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Неверные учётные данные');
    }
    return user;
  }

  async login(username: string, password: string) {
    const key = this.assertLoginAllowed(String(username || ''));
    let user;
    try {
      user = await this.validateUser(String(username || ''), String(password || ''));
    } catch (error) {
      if (error instanceof UnauthorizedException) this.recordFailure(key);
      throw error;
    }
    this.failedLogins.delete(key);

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.roleId,
      ver: user.tokenVersion,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.roleId,
        permissions: user.role.permissions,
        chatId: user.chatId,
        telegramId: user.telegramId,
        theme: user.theme,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { message: 'Выход выполнен; сессии отозваны' };
  }

  async updateMyProfile(userId: string, data: any) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, fullName: true, chatId: true, telegramId: true, theme: true, isActive: true, role: { select: { id: true, name: true, permissions: true } } } });
    if (!existing || !existing.isActive) throw new UnauthorizedException();

    const updateData: any = {};
    if (data.username !== undefined) {
      const username = typeof data.username === 'string' ? data.username.trim() : '';
      if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) throw new BadRequestException('Логин должен содержать 3–64 символа: буквы, цифры, ., _ или -');
      updateData.username = username;
    }
    if (data.fullName !== undefined) {
      if (typeof data.fullName !== 'string' || data.fullName.trim().length < 2 || data.fullName.trim().length > 120) throw new BadRequestException('Некорректное ФИО');
      updateData.fullName = data.fullName.trim();
    }
    for (const field of ['chatId', 'telegramId'] as const) {
      if (data[field] !== undefined) {
        if (data[field] !== null && (typeof data[field] !== 'string' || data[field].length > 128)) throw new BadRequestException(`Некорректное поле ${field}`);
        updateData[field] = data[field] === '' ? null : data[field];
      }
    }
    if (data.theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(data.theme)) throw new BadRequestException('Некорректная тема оформления');
      updateData.theme = data.theme;
    }
    if (Object.keys(updateData).length === 0) return { ...existing, role: existing.role.id, permissions: existing.role.permissions };

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: { id: true, username: true, fullName: true, chatId: true, telegramId: true, theme: true, role: { select: { id: true, name: true, permissions: true } } },
      });
      return { ...user, role: user.role.id, permissions: user.role.permissions };
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Этот логин уже используется');
      throw error;
    }
  }

  async changeMyPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, password: true, fullName: true, roleId: true, tokenVersion: true, isActive: true, role: { select: { permissions: true } } },
    });
    if (!user || !user.isActive || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Текущий пароль указан неверно');
    }
    if (newPassword.length < 12 || newPassword.length > 128) throw new BadRequestException('Новый пароль должен содержать от 12 до 128 символов');

    const password = await bcrypt.hash(newPassword, 12);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { password, tokenVersion: { increment: 1 } },
      select: { id: true, username: true, fullName: true, roleId: true, tokenVersion: true, chatId: true, telegramId: true, theme: true, role: { select: { permissions: true } } },
    });
    const access_token = this.jwtService.sign({ sub: updated.id, username: updated.username, role: updated.roleId, ver: updated.tokenVersion });
    return {
      access_token,
      user: { id: updated.id, username: updated.username, fullName: updated.fullName, role: updated.roleId, permissions: updated.role.permissions, chatId: updated.chatId, telegramId: updated.telegramId, theme: updated.theme },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, fullName: true, isActive: true, chatId: true, telegramId: true, theme: true, role: { select: { id: true, name: true, permissions: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { id: user.id, username: user.username, fullName: user.fullName, role: user.role.id, permissions: user.role.permissions, chatId: user.chatId, telegramId: user.telegramId, theme: user.theme };
  }
}
