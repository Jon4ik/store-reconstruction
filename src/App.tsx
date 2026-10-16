import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StoreTable from './components/StoreTable';
import StoreCard from './components/StoreCard';
import CalendarView from './components/CalendarView';
import AddStoreModal from './components/AddStoreModal';
import LoginPage from './components/LoginPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import TUsPage from './pages/TUsPage';
import AuditPage from './pages/AuditPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import ShopsPage from './pages/ShopsPage';
import SchedulerPage from './pages/SchedulerPage';
import { apiClient } from './api/client';

const PAGE_PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  table: '/objects',
  calendar: '/calendar',
  users: '/users',
  roles: '/roles',
  tus: '/directory/tu',
  shops: '/directory/shops',
  scheduler: '/settings/scheduler',
  audit: '/audit',
  profile: '/profile',
  settings: '/settings/ldap',
  integrations: '/settings/integrations',
  notifications: '/notifications',
};

function getPageFromPath(): string {
  return Object.entries(PAGE_PATHS).find(([, path]) => path === window.location.pathname)?.[0] || 'dashboard';
}

export default function App() {
  const { currentUser, restoreSession, loadProjects, loadTUs, loadUsers, loadRoles, loadAuditLog, defaultWorkType } = useStore();
  const [currentPage, setCurrentPage] = useState(getPageFromPath);

  const navigateToPage = (page: string) => {
    const nextPage = PAGE_PATHS[page] ? page : 'dashboard';
    const nextPath = PAGE_PATHS[nextPage];
    if (window.location.pathname !== nextPath) window.history.pushState({ page: nextPage }, '', nextPath);
    setCurrentPage(nextPage);
  };

  // Поддерживаем ЧПУ-ссылки, прямое открытие разделов и кнопки «Назад/Вперёд».
  useEffect(() => {
    if (!Object.values(PAGE_PATHS).includes(window.location.pathname)) {
      window.history.replaceState({ page: currentPage }, '', PAGE_PATHS[currentPage] || PAGE_PATHS.dashboard);
    }
    const handlePopState = () => setCurrentPage(getPageFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Применяем тему пользователя ко всему приложению сразу после входа/восстановления сессии.
  useEffect(() => {
    document.documentElement.dataset.theme = currentUser?.theme || 'light';
  }, [currentUser?.theme]);

  // Автоматически завершаем клиентскую сессию по exp текущего JWT.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!currentUser || !token) return;
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) throw new Error('Invalid JWT');
      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(normalized));
      if (typeof payload.exp !== 'number') throw new Error('JWT has no exp');
      const remaining = payload.exp * 1000 - Date.now();
      if (remaining <= 0) { void useStore.getState().logout(); return; }
      const timeout = window.setTimeout(() => { void useStore.getState().logout(); }, Math.min(remaining, 2147483647));
      return () => window.clearTimeout(timeout);
    } catch {
      void useStore.getState().logout();
    }
  }, [currentUser?.id]);

  // Восстанавливаем сессию при загрузке
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Обновляем профиль после восстановления старой сессии, чтобы роль была известна даже без права просмотра списка ролей.
  useEffect(() => {
    if (currentUser && !currentUser.roleName) {
      let active = true;
      apiClient.getProfile().then((profile: any) => {
        if (!active) return;
        const merged = { ...(useStore.getState().currentUser || currentUser), ...profile };
        useStore.setState({ currentUser: merged });
        localStorage.setItem('currentUser', JSON.stringify(merged));
      }).catch(() => {});
      return () => { active = false; };
    }
  }, [currentUser?.id, currentUser?.roleName]);

  // Загружаем данные из API при входе
  useEffect(() => {
    if (currentUser) {
      loadProjects();
      loadTUs();
      if (currentUser.permissions?.includes('view_users')) loadUsers();
      if (currentUser.permissions?.includes('view_roles')) loadRoles();
      if (currentUser.permissions?.includes('view_audit')) loadAuditLog();
    }
  }, [currentUser, loadProjects, loadTUs, loadUsers, loadRoles, loadAuditLog]);

  // Обновляем данные в фоне и при возвращении во вкладку — без перезагрузки страницы.
  useEffect(() => {
    if (!currentUser) return;
    let refreshInProgress = false;
    const refreshData = async () => {
      if (document.visibilityState === 'hidden' || refreshInProgress) return;
      refreshInProgress = true;
      try {
        await Promise.all([loadProjects(), loadTUs(), loadUsers(), loadRoles(), loadAuditLog()]);
      } finally {
        refreshInProgress = false;
      }
    };
    const intervalId = window.setInterval(() => { void refreshData(); }, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshData();
    };
    window.addEventListener('focus', refreshData);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.id, loadProjects, loadTUs, loadUsers, loadRoles, loadAuditLog]);

  // Динамический title
  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: 'Панель управления',
      table: 'Таблица объектов',
      calendar: 'Календарь',
      users: 'Пользователи',
      roles: 'Роли',
      tus: 'Справочник ТУ',
      audit: 'Аудит',
      profile: 'Профиль',
      settings: 'Синхронизация с LDAP',
      integrations: 'Интеграции',
      notifications: 'Уведомления',
      shops: 'Справочник магазинов',
      scheduler: 'Планировщик (crontab)',
    };
    
    document.title = `${titles[currentPage] || 'Главная'} - Реконструкция`;
  }, [currentPage]);

  if (!currentUser) return <LoginPage />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'table': return <StoreTable />;
      case 'calendar': return <CalendarView />;
      case 'users': return <UsersPage />;
      case 'roles': return <RolesPage />;
      case 'tus': return <TUsPage />;
      case 'shops': return <ShopsPage />;
      case 'scheduler': return <SchedulerPage />;
      case 'audit': return <AuditPage />;
      case 'profile': return <ProfilePage />;
      case 'settings': return <SettingsPage />;
      case 'integrations': return <SettingsPage mode="integrations" />;
      case 'notifications': return <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center"><h1 className="text-xl font-semibold text-gray-900">Уведомления</h1><p className="mt-2 text-sm text-gray-500">Настройка уведомлений будет добавлена позже.</p></div>;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={navigateToPage}>
        {renderPage()}
      </Layout>
      <StoreCard />
      <AddStoreModal />
    </>
  );
}
