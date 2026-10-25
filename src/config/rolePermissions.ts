export const permissionModules = [
    {
      name: 'Объекты (Закрытия/Реконструкции)',
      key: 'closures',
      permissions: [
        { key: 'view_closures', label: 'Просмотр' },
        { key: 'create_closures', label: 'Создание' },
        { key: 'edit_closures', label: 'Редактирование' },
        { key: 'delete_closures', label: 'Удаление' },
      ]
    },
    {
      name: 'Объекты (Открытия)',
      key: 'openings',
      permissions: [
        { key: 'view_openings', label: 'Просмотр' },
        { key: 'create_openings', label: 'Создание' },
        { key: 'edit_openings', label: 'Редактирование' },
        { key: 'delete_openings', label: 'Удаление' },
      ]
    },
    {
      name: 'Календарь',
      key: 'calendar',
      permissions: [
        { key: 'view_calendar', label: 'Просмотр' },
      ]
    },
    {
      name: 'Панель управления',
      key: 'dashboard',
      permissions: [
        { key: 'view_dashboard', label: 'Просмотр' },
      ]
    },
    {
      name: 'Экспорт',
      key: 'export',
      permissions: [ { key: 'export', label: 'Экспорт в Excel/CSV' } ]
    },
    {
      name: 'Комментарии',
      key: 'comments',
      permissions: [
        { key: 'view_comments', label: 'Просмотр' },
        { key: 'add_comments', label: 'Добавление' },
      ]
    },
    {
      name: 'Пользователи',
      key: 'users',
      permissions: [
        { key: 'view_users', label: 'Просмотр' },
        { key: 'manage_users', label: 'Управление (создание, редактирование, удаление)' },
      ]
    },
    {
      name: 'Роли',
      key: 'roles',
      permissions: [
        { key: 'view_roles', label: 'Просмотр' },
        { key: 'manage_roles', label: 'Управление (создание, редактирование, удаление)' },
      ]
    },
    {
      name: 'Справочник ТУ',
      key: 'tus',
      permissions: [
        { key: 'view_tus', label: 'Просмотр' },
        { key: 'manage_tus', label: 'Управление (создание, редактирование, удаление)' },
      ]
    },
    {
      name: 'Справочник магазинов',
      key: 'shops',
      permissions: [
        { key: 'view_shops', label: 'Просмотр справочника (открытие страницы)' },
        { key: 'manage_shops', label: 'Ручная синхронизация справочника' },
      ]
    },
    {
      name: 'Планировщик',
      key: 'scheduler',
      permissions: [ { key: 'manage_scheduler', label: 'Настройка и запуск задач' } ]
    },
    {
      name: 'Аудит',
      key: 'audit',
      permissions: [
        { key: 'view_audit', label: 'Просмотр журнала' },
        { key: 'clear_audit', label: 'Очистка журнала' },
      ]
    },
    {
      name: 'Настройки',
      key: 'settings',
      permissions: [
        { key: 'view_notifications', label: 'Уведомления: просмотр' },
        { key: 'create_notifications', label: 'Уведомления: создание' },
        { key: 'edit_notifications', label: 'Уведомления: редактирование и включение' },
        { key: 'delete_notifications', label: 'Уведомления: удаление' },
        { key: 'manage_ldap', label: 'Настройки LDAP / Active Directory' },
        { key: 'manage_integrations', label: 'Настройки интеграций' },
      ]
    },
  ];
