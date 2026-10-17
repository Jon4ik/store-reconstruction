import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { StoresModule } from './modules/stores/stores.module';
import { TUsModule } from './modules/tus/tus.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuditModule } from './modules/audit/audit.module';
import { LdapModule } from './modules/ldap/ldap.module';
import { HealthController } from './health.controller';
import { ShopsModule } from './modules/shops/shops.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';

@Module({
  imports: [
    AuthModule,
    StoresModule,
    TUsModule,
    UsersModule,
    RolesModule,
    AuditModule,
    LdapModule,
    ShopsModule,
    SchedulerModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [PrismaService],
})
export class AppModule {}
