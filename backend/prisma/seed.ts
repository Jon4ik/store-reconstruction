import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding roles and TUs...');
  const adminPermissions = ['view', 'edit', 'view_closures', 'create_closures', 'edit_closures', 'delete_closures', 'view_openings', 'create_openings', 'edit_openings', 'delete_openings', 'view_calendar', 'view_dashboard', 'export', 'view_comments', 'add_comments', 'delete_comments', 'view_users', 'manage_users', 'view_roles', 'manage_roles', 'view_tus', 'manage_tus', 'view_audit', 'manage_ldap', 'manage_integrations', 'manage_notifications', 'view_shops', 'manage_shops', 'manage_scheduler'];
  const managerPermissions = ['view', 'edit', 'view_closures', 'create_closures', 'edit_closures', 'view_openings', 'create_openings', 'edit_openings', 'view_calendar', 'view_dashboard', 'export', 'view_comments', 'add_comments', 'view_tus', 'view_shops'];
  const viewerPermissions = ['view', 'view_closures', 'view_openings', 'view_calendar', 'view_dashboard', 'view_comments', 'view_tus', 'view_shops'];

  const adminRole = await prisma.role.upsert({
    where: { name: 'Администратор' },
    update: { permissions: adminPermissions },
    create: { name: 'Администратор', description: 'Полный доступ ко всем функциям системы', permissions: adminPermissions, isSystem: true },
  });
  await prisma.role.upsert({
    where: { name: 'Менеджер' },
    update: { permissions: managerPermissions },
    create: { name: 'Менеджер', description: 'Управление объектами и экспорт', permissions: managerPermissions, isSystem: true },
  });
  await prisma.role.upsert({
    where: { name: 'Наблюдатель' },
    update: { permissions: viewerPermissions },
    create: { name: 'Наблюдатель', description: 'Только просмотр данных', permissions: viewerPermissions, isSystem: true },
  });

  // Demo accounts are opt-in only. Never create predictable production credentials.
  if (process.env.SEED_DEMO_USERS === 'true') {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const managerPassword = process.env.SEED_MANAGER_PASSWORD;
    const viewerPassword = process.env.SEED_VIEWER_PASSWORD;
    if ([adminPassword, managerPassword, viewerPassword].some((value) => !value || value.length < 12)) {
      throw new Error('Для SEED_DEMO_USERS=true задайте все SEED_*_PASSWORD длиной минимум 12 символов');
    }
    for (const account of [
      { username: 'admin', fullName: 'Администратор Системы', roleId: adminRole.id, password: adminPassword! },
      { username: 'manager', fullName: 'Менеджер', roleId: (await prisma.role.findUniqueOrThrow({ where: { name: 'Менеджер' } })).id, password: managerPassword! },
      { username: 'viewer', fullName: 'Наблюдатель', roleId: (await prisma.role.findUniqueOrThrow({ where: { name: 'Наблюдатель' } })).id, password: viewerPassword! },
    ]) {
      const hash = await bcrypt.hash(account.password, 12);
      await prisma.user.upsert({
        where: { username: account.username },
        update: { password: hash, tokenVersion: { increment: 1 }, isActive: true, fullName: account.fullName, roleId: account.roleId },
        create: { username: account.username, password: hash, fullName: account.fullName, roleId: account.roleId },
      });
    }
    console.log('Demo accounts seeded with explicitly supplied passwords.');
  }

  else {
    // Built-in accounts are protected system accounts. Older seed versions could
    // disable them, which locked administrators out. Re-enable them without
    // changing their existing password; disabling them is blocked by UsersService.
    for (const username of ['admin', 'manager', 'viewer']) {
      const existing = await prisma.user.findUnique({ where: { username }, select: { id: true, isActive: true } });
      if (existing && !existing.isActive) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { isActive: true, tokenVersion: { increment: 1 } },
        });
        console.warn(`Re-enabled protected system account "${username}".`);
      }
    }
  }

  // One-time production bootstrap: supply a strong password, then remove the variable.
  const bootstrapAdminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (bootstrapAdminPassword !== undefined && bootstrapAdminPassword !== '') {
    if (bootstrapAdminPassword.length < 12 || bootstrapAdminPassword.length > 128) {
      throw new Error('BOOTSTRAP_ADMIN_PASSWORD должен содержать 12–128 символов');
    }
    const hash = await bcrypt.hash(bootstrapAdminPassword, 12);
    await prisma.user.upsert({
      where: { username: 'admin' },
      update: { password: hash, tokenVersion: { increment: 1 }, isActive: true, roleId: adminRole.id },
      create: { username: 'admin', password: hash, fullName: 'Администратор Системы', roleId: adminRole.id },
    });
    console.log('Administrator account bootstrapped with a supplied password.');
  }

  const tus = [
    { fullName: 'Зотов Денис', position: 'Территориальный управляющий', phone: '+7 (999) 123-45-67', email: 'zotov@company.ru' },
    { fullName: 'Дрямова Валентина', position: 'Территориальный управляющий', phone: '+7 (999) 234-56-78', email: 'dryamova@company.ru' },
    { fullName: 'Беляева Анна', position: 'Территориальный управляющий', phone: '+7 (999) 345-67-89', email: 'belyaeva@company.ru' },
  ];
  for (const tu of tus) {
    const id = `tu-${tu.fullName.replace(/\s/g, '-').toLowerCase()}`;
    await prisma.tU.upsert({ where: { id }, update: {}, create: { id, ...tu } });
  }
  console.log('Seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
