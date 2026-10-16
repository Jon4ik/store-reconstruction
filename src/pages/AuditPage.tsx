import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function AuditPage() {
  const { auditLog, hasPermission, projects, users } = useStore();
  const [filter, setFilter] = useState({ action: '', search: '', module: '' });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (!hasPermission('view_audit')) {
    return <div className="text-center py-12 text-gray-500">Нет доступа к этой странице</div>;
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Определение подсистемы по действию
  const getModule = (action: string): string => {
    if (action.includes('tu')) return 'Справочник ТУ';
    if (action.includes('role')) return 'Роли';
    if (action.includes('comment')) return 'Комментарии';
    if (action === 'login' || action === 'logout') return 'Авторизация';
    if (action === 'import') return 'Импорт';
    if (action === 'create' || action === 'update' || action === 'delete') return 'Объекты';
    return 'Система';
  };

  const filteredLog = auditLog.filter(log => {
    // Legacy user/profile audit events are intentionally hidden.
    if (log.action === 'reset_password') return false;
    if (filter.action && log.action !== filter.action) return false;
    if (filter.module && getModule(log.action) !== filter.module) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      return String(log.details || '').toLowerCase().includes(search) || String(log.userName || '').toLowerCase().includes(search);
    }
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const actionLabels: Record<string, string> = {
    login: 'Вход', logout: 'Выход', create: 'Создание', update: 'Обновление',
    delete: 'Удаление', change_color: 'Изменение цвета строки', import: 'Импорт', create_user: 'Создание пользователя',
    update_user: 'Обновление пользователя', delete_user: 'Удаление пользователя',
    create_tu: 'Создание ТУ', update_tu: 'Обновление ТУ', delete_tu: 'Удаление ТУ',
    create_role: 'Создание роли', update_role: 'Обновление роли', delete_role: 'Удаление роли',
    add_comment: 'Комментарий',
  };

  const actionColors: Record<string, string> = {
    login: 'bg-green-100 text-green-700', logout: 'bg-gray-100 text-gray-700',
    create: 'bg-blue-100 text-blue-700', update: 'bg-yellow-100 text-yellow-700',
    delete: 'bg-red-100 text-red-700', change_color: 'bg-fuchsia-100 text-fuchsia-700', import: 'bg-purple-100 text-purple-700',
    create_user: 'bg-blue-100 text-blue-700', update_user: 'bg-yellow-100 text-yellow-700',
    delete_user: 'bg-red-100 text-red-700', create_tu: 'bg-blue-100 text-blue-700',
    update_tu: 'bg-yellow-100 text-yellow-700', delete_tu: 'bg-red-100 text-red-700',
    create_role: 'bg-blue-100 text-blue-700', update_role: 'bg-yellow-100 text-yellow-700',
    delete_role: 'bg-red-100 text-red-700', add_comment: 'bg-indigo-100 text-indigo-700',
  };

  const moduleColors: Record<string, string> = {
    'Справочник ТУ': 'bg-green-100 text-green-700',
    'Роли': 'bg-purple-100 text-purple-700',
    'Комментарии': 'bg-indigo-100 text-indigo-700',
    'Авторизация': 'bg-green-100 text-green-700',
    'Импорт': 'bg-orange-100 text-orange-700',
    'Объекты': 'bg-blue-100 text-blue-700',
    'Система': 'bg-gray-100 text-gray-700',
  };

  const uniqueActions = [...new Set(auditLog.map(l => l.action).filter(action => action !== 'reset_password'))];

  const getUserName = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    return user?.fullName || userId;
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аудит действий</h1>
          <p className="text-sm text-gray-500 mt-1">История всех действий в системе ({auditLog.length} записей)</p>
        </div>
        <p className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-2">Журнал доступен только для чтения</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Подсистема</label>
            <select value={filter.module} onChange={e => setFilter({ ...filter, module: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Все подсистемы</option>
              <option value="Справочник ТУ">Справочник ТУ</option>
              <option value="Роли">Роли</option>
              <option value="Комментарии">Комментарии</option>
              <option value="Авторизация">Авторизация</option>
              <option value="Импорт">Импорт</option>
              <option value="Объекты">Объекты</option>
              <option value="Система">Система</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Тип действия</label>
            <select value={filter.action} onChange={e => setFilter({ ...filter, action: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Все действия</option>
              {uniqueActions.map(a => <option key={a} value={a}>{actionLabels[a] || a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Поиск</label>
            <input type="text" value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="По пользователю или описанию..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-w-0">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-8"></th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Дата</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Подсистема</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Действие</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Пользователь</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Описание</th>
              </tr>
            </thead>
            <tbody>
              {filteredLog.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Нет записей</td></tr>
              ) : filteredLog.map(log => {
                const project = log.storeId ? projects.find(p => p.id === log.storeId) : null;
                const timestamp = new Date(log.timestamp);
                const dateStr = `${String(timestamp.getDate()).padStart(2, '0')}.${String(timestamp.getMonth() + 1).padStart(2, '0')}.${timestamp.getFullYear()}`;
                const timeStr = `${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}`;
                const module = getModule(log.action);
                const isExpanded = expandedRows.has(log.id);
                
                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleRow(log.id)}
                    >
                      <td className="px-4 py-3">
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                        <div>{dateStr}</div>
                        <div className="text-gray-400">{timeStr}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${moduleColors[module] || 'bg-gray-100 text-gray-700'}`}>
                          {module}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${actionColors[log.action] || 'bg-gray-100 text-gray-700'}`}>
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 text-xs">{getUserName(log.userId)}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{log.details}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-blue-50 border-b border-gray-200">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">ID записи</p>
                                <p className="text-xs font-mono text-gray-700 break-all">{log.id}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">ID пользователя</p>
                                <p className="text-xs font-mono text-gray-700 break-all">{log.userId}</p>
                              </div>
                            </div>
                            
                            {log.storeId && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">ID объекта</p>
                                <p className="text-xs font-mono text-gray-700 break-all">{log.storeId}</p>
                                {project && (
                                  <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                                    <p className="text-xs text-gray-600">
                                      <span className="font-medium">Объект:</span> №{project.storeNumber} - {project.address}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {(log.oldValue || log.newValue) && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Изменения</p>
                                <div className="p-3 bg-white rounded border border-gray-200">
                                  {log.oldValue && (
                                    <div className="mb-2">
                                      <span className="text-xs text-gray-500">Было:</span>
                                      <p className="text-xs text-red-600 break-all">{log.oldValue}</p>
                                    </div>
                                  )}
                                  {log.newValue && (
                                    <div>
                                      <span className="text-xs text-gray-500">Стало:</span>
                                      <p className="text-xs text-green-600 break-all">{log.newValue}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Полная дата и время</p>
                              <p className="text-xs text-gray-700">{timestamp.toLocaleString('ru-RU')}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
