import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { StoresModule } from './modules/stores/stores.module';
import { TUsModule } from './modules/tus/tus.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuditModule } from './modules/audit/audit.module';
import { ImportModule } from './modules/import/import.module';
import { LdapModule } from './modules/ldap/ldap.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    AuthModule,
    StoresModule,
    TUsModule,
    UsersModule,
    RolesModule,
    AuditModule,
    ImportModule,
    LdapModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
