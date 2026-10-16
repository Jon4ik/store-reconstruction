import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { LayoutDashboard, Table2, CalendarDays, LogOut, Menu, X, User, Users, Shield, UserCheck, FileText, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { currentUser, logout, hasPermission, roles } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ users: currentPage === 'users' || currentPage === 'roles', directory: currentPage === 'tus', settings: ['settings','integrations','notifications'].includes(currentPage) });

  const mainNavItems = [
    { id: 'dashboard', label: 'Панель управления', icon: LayoutDashboard, permission: 'view_dashboard' },
    { id: 'table', label: 'Таблица объектов', icon: Table2, permission: 'view_closures' },
    { id: 'calendar', label: 'Календарь', icon: CalendarDays, permission: 'view_calendar' },
  ];

  const adminGroups = [
    { id: 'users', label: 'Пользователи', icon: Users, items: [
      { id: 'users', label: 'Пользователи', permission: 'manage_users' },
      { id: 'roles', label: 'Роли', permission: 'manage_roles' },
    ]},
    { id: 'directory', label: 'Справочник', icon: UserCheck, items: [
      { id: 'tus', label: 'Справочник ТУ', permission: 'manage_tus' },
    ]},
    { id: 'settings', label: 'Настройки', icon: Settings, items: [
      { id: 'settings', label: 'Синхронизация с LDAP', permission: 'manage_ldap' },
      { id: 'integrations', label: 'Интеграции', permission: 'manage_integrations' },
      { id: 'notifications', label: 'Уведомления', permission: 'manage_notifications' },
    ]},
    { id: 'audit', label: 'Аудит', icon: FileText, items: [
      { id: 'audit', label: 'Аудит', permission: 'view_audit' },
    ]},
  ];

  const currentRole = currentUser && roles.length > 0 ? roles.find(r => r.id === currentUser.role) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-all duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-blue-700">РиЗ</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500"><X size={20} /></button>
        </div>
        
        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {mainNavItems.filter(item => hasPermission(item.permission)).map(item => (
            <button key={item.id} onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentPage === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              <item.icon size={18} /><span>{item.label}</span>
            </button>
          ))}
          
          {adminGroups.some(group => group.items.some(item => hasPermission(item.permission))) && <>
            <div className="pt-4 mt-4 border-t border-gray-200"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 mb-2">Администрирование</p></div>
            {adminGroups.filter(group => group.items.some(item => hasPermission(item.permission))).map(group => <div key={group.id} className="space-y-1">
              <button onClick={()=>setOpenGroups(current=>({...current,[group.id]:!current[group.id]}))} aria-expanded={Boolean(openGroups[group.id])} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100">
                <span className="flex items-center gap-3"><group.icon size={18}/>{group.label}</span><span className="text-xs">{openGroups[group.id]?'−':'+'}</span>
              </button>
              {openGroups[group.id] && group.items.filter(item=>hasPermission(item.permission)).map(item=><button key={item.id} onClick={()=>{onNavigate(item.id);setSidebarOpen(false)}} className={`w-full pl-10 pr-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${currentPage===item.id?'bg-blue-50 text-blue-700':'text-gray-600 hover:bg-gray-100'}`}>{item.label}</button>)}
            </div>)}
          </>}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className={`flex items-center gap-3 mb-3 `}>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={16} className="text-blue-600" />
            </div>
            <div className={`flex-1 min-w-0 `}>
              <p className="text-sm font-medium text-gray-900 truncate">{currentUser?.fullName}</p>
              <p className="text-xs text-gray-500">{currentRole?.name || '—'}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium">
            <LogOut size={16} /><span>Выйти из системы</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600"><Menu size={24} /></button>
          </div>
          <button 
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <User size={18} />
            <span className="hidden sm:inline">Профиль</span>
          </button>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
