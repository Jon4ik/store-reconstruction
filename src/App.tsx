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

export default function App() {
  const { currentUser, restoreSession, loadProjects, loadTUs, loadUsers, loadRoles, loadAuditLog, defaultWorkType } = useStore();
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Применяем тему пользователя ко всему приложению сразу после входа/восстановления сессии.
  useEffect(() => {
    document.documentElement.dataset.theme = currentUser?.theme || 'light';
  }, [currentUser?.theme]);

  // Восстанавливаем сессию при загрузке
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Загружаем данные из API при входе
  useEffect(() => {
    if (currentUser) {
      loadProjects();
      loadTUs();
      loadUsers();
      loadRoles();
      loadAuditLog();
    }
  }, [currentUser, loadProjects, loadTUs, loadUsers, loadRoles, loadAuditLog]);

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
      settings: 'Настройки LDAP',
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
      case 'audit': return <AuditPage />;
      case 'profile': return <ProfilePage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </Layout>
      <StoreCard />
      <AddStoreModal />
    </>
  );
}
