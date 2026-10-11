import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { LdapController } from './ldap.controller';
import { LdapService } from './ldap.service';

@Module({ controllers: [LdapController], providers: [LdapService, PrismaService, PermissionsGuard] })
export class LdapModule {}
