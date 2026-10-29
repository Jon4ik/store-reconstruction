import VideoregsPage from './pages/VideoregsPage';
import { usePageData } from './hooks/usePageData';
import { canAccessPage } from './utils/permissions';
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
import NotificationsPage from './pages/NotificationsPage';
import { apiClient } from './api/client';

const PAGE_PATHS: Record<string, string> = {
  videoregs:'/videoregs',
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
  notifications: '/settings/notifications',
};

function getPageFromPath(): string {
  if (window.location.pathname === '/notifications') return 'notifications';
  return Object.entries(PAGE_PATHS).find(([, path]) => path === window.location.pathname)?.[0] || 'dashboard';
}

export default function App() {
  const { currentUser, restoreSession, loadProjects, loadTUs, loadUsers, loadRoles, loadAuditLog, defaultWorkType } = useStore();
  const [currentPage, setCurrentPage] = useState(getPageFromPath);
  usePageData(currentPage);

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
    const handlePopState = () => {
      const page = getPageFromPath();
      if (window.location.pathname === '/notifications') window.history.replaceState({ page }, '', PAGE_PATHS.notifications);
      setCurrentPage(page);
    };
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

  // Синхронизируем роль и разрешения с сервером без повторного входа.
  // Это также подхватывает изменения роли пользователя, выполненные администратором.
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    let refreshInProgress = false;

    const refreshCurrentUser = async () => {
      if (!active || refreshInProgress || document.visibilityState === 'hidden') return;
      refreshInProgress = true;
      try {
        const profile = await apiClient.getProfile();
        if (!active || !profile?.id || profile.id !== useStore.getState().currentUser?.id) return;

        const latestUser = useStore.getState().currentUser;
        if (!latestUser) return;
        const merged = { ...latestUser, ...profile };
        const normalize = (user: any) => JSON.stringify({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          roleName: user.roleName,
          permissions: [...(user.permissions || [])].sort(),
          theme: user.theme,
        });

        if (normalize(latestUser) !== normalize(merged)) {
          useStore.setState({ currentUser: merged });
          localStorage.setItem('currentUser', JSON.stringify(merged));
          document.documentElement.dataset.theme = merged.theme || 'light';

          const state = useStore.getState();
          if (!state.hasPermission('view_users')) useStore.setState({ users: [] });
          if (!state.hasPermission('view_roles') && !state.hasPermission('manage_users')) useStore.setState({ roles: [] });
          if (!state.hasPermission('view_audit')) useStore.setState({ auditLog: [] });
          if (!state.hasPermission('view_comments')) useStore.setState({ comments: [] });
          useStore.setState({ projects: state.projects.filter(project => state.hasPermission(project.workType === 'Открытие' ? 'view_openings' : 'view_closures')) });
        }
      } catch (error) {
        // Keep the current session intact on transient network errors; retry on the next poll/focus.
        console.warn('Не удалось обновить роль и разрешения пользователя:', error);
      } finally {
        refreshInProgress = false;
      }
    };

    void refreshCurrentUser();
    const intervalId = window.setInterval(() => { void refreshCurrentUser(); }, 15_000);
    const handleFocus = () => { void refreshCurrentUser(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshCurrentUser();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.id]);

  // Динамический title
  useEffect(() => {
    const titles: Record<string, string> = {
      videoregs:'Видеорегистраторы',
      dashboard: 'Панель управления',
      table: 'Таблица событий магазинов',
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
    if (!canAccessPage(currentUser.permissions, currentPage)) return <div className="roles-empty"><h2>Нет доступа к разделу</h2><p>Обратитесь к администратору для изменения прав вашей роли.</p></div>;
    switch (currentPage) {
      case 'videoregs': return <VideoregsPage/>;
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
      case 'notifications': return <NotificationsPage />;
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
