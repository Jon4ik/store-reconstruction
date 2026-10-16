import { StoreProject, TU, SystemUser, Role } from '../types';

// Начальные данные больше не используются - все данные загружаются из PostgreSQL через API
export const seedTUs: TU[] = [];
export const seedProjects: StoreProject[] = [];

// Системные роли (создаются при инициализации БД)
export const seedRoles: Role[] = [
  { 
    id: 'role-admin', 
    name: 'Администратор', 
    description: 'Полный доступ ко всем функциям системы',
    permissions: ['view', 'edit', 'view_closures', 'create_closures', 'edit_closures', 'delete_closures', 'view_openings', 'create_openings', 'edit_openings', 'delete_openings', 'view_calendar', 'view_dashboard', 'export', 'view_comments', 'add_comments', 'delete_comments', 'view_users', 'manage_users', 'view_roles', 'manage_roles', 'view_tus', 'manage_tus', 'view_audit', 'manage_ldap', 'manage_integrations', 'manage_notifications', 'view_shops', 'manage_shops', 'manage_scheduler'],
    isSystem: true 
  },
  { 
    id: 'role-manager', 
    name: 'Менеджер', 
    description: 'Управление объектами и импорт/экспорт',
    permissions: ['view', 'edit', 'view_closures', 'create_closures', 'edit_closures', 'view_openings', 'create_openings', 'edit_openings', 'view_calendar', 'view_dashboard', 'export', 'view_comments', 'add_comments', 'view_tus', 'view_shops'],
    isSystem: true 
  },
  { 
    id: 'role-viewer', 
    name: 'Наблюдатель', 
    description: 'Только просмотр данных',
    permissions: ['view', 'view_closures', 'view_openings', 'view_calendar', 'view_dashboard', 'view_comments', 'view_tus', 'view_shops'],
    isSystem: true 
  },
];

// Системные пользователи (создаются при инициализации БД)
export const seedUsers: SystemUser[] = []; // Authentication is exclusively handled by the backend API.
