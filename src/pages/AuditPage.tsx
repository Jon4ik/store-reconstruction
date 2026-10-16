import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, ChevronUp, Search, RotateCcw, Trash2 } from 'lucide-react';
import type { AuditLogEntry } from '../types';

type AuditDetails = {
  outcome?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  payload?: unknown;
  [key: string]: unknown;
};

const HIDDEN_ACTIONS = new Set([
  'reset_password', 'create_user', 'update_user', 'delete_user',
  'update_profile', 'change_password', 'profile_update',
]);

function parseDetails(value: string | undefined): AuditDetails {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getRequestPath(log: AuditLogEntry): string {
  return log.action === 'api_request' ? String(log.newValue || '').replace(/^[A-Z]+\s+/, '') : '';
}

function isHiddenEvent(log: AuditLogEntry): boolean {
  if (HIDDEN_ACTIONS.has(log.action)) return true;
  const route = getRequestPath(log).toLowerCase();
  return route.includes('/users') || route.includes('/auth/profile') || route.includes('/auth/password');
}

function getModule(log: AuditLogEntry): string {
  const action = String(log.action || '').toLowerCase();
  const route = getRequestPath(log).toLowerCase();
  if (action.includes('audit') || route.includes('/audit')) return 'Аудит';
  if (action === 'login' || action === 'logout' || route.includes('/auth/logout')) return 'Авторизация';
  if (action === 'scheduler_run' || route.includes('/scheduler')) return 'Планировщик';
  if (route.includes('/ldap') || route.includes('/integrations') || route.includes('/notifications')) return 'Настройки';
  if (route.includes('/shops')) return 'Справочник магазинов';
  if (route.includes('/roles') || action.includes('role')) return 'Роли';
  if (route.includes('/tus') || action.includes('tu')) return 'Справочник ТУ';
  if (route.includes('/comments') || action.includes('comment')) return 'Комментарии';
  if (route.includes('/stores') || ['create', 'update', 'delete', 'change_color', 'restore'].includes(action)) return 'Объекты';
  return 'Система';
}

const ACTION_LABELS: Record<string, string> = {
  login: 'Вход в систему',
  logout: 'Выход из системы',
  clear_audit: 'Очистка журнала аудита',
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  restore: 'Восстановление',
  change_color: 'Изменение цвета строки',
  create_tu: 'Создание ТУ',
  update_tu: 'Изменение ТУ',
  delete_tu: 'Удаление ТУ',
  create_role: 'Создание роли',
  update_role: 'Изменение роли',
  delete_role: 'Удаление роли',
  add_comment: 'Добавление комментария',
  api_request: 'Запрос к API',
  scheduler_run: 'Запуск задачи',
};

function getActionLabel(log: AuditLogEntry): string {
  if (log.action === 'api_request' && getRequestPath(log).toLowerCase().includes('/auth/logout')) return 'Выход из системы';
  return ACTION_LABELS[log.action] || log.action;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  logout: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  clear_audit: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  create: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  update: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  restore: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  change_color: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  api_request: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  scheduler_run: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
};

const MODULE_COLORS: Record<string, string> = {
  'Авторизация': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  'Аудит': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  'Объекты': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'Комментарии': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  'Справочник ТУ': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  'Роли': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  'Настройки': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  'Планировщик': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  'Справочник магазинов': 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  'Система': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

export default function AuditPage() {
  const { auditLog, hasPermission, projects, clearAuditLog } = useStore();
  const [filter, setFilter] = useState({ action: '', search: '', module: '', outcome: '' });
  const [clearingAudit, setClearingAudit] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (!hasPermission('view_audit')) {
    return <div className="text-center py-12 text-gray-500">Нет доступа к этой странице</div>;
  }

  const visibleLog = auditLog.filter(log => !isHiddenEvent(log));
  const filteredLog = visibleLog.filter(log => {
    const details = parseDetails(log.details);
    const module = getModule(log);
    if (filter.action && log.action !== filter.action) return false;
    if (filter.module && module !== filter.module) return false;
    if (filter.outcome) {
      const isError = Number(details.statusCode || 0) >= 400 || details.outcome === 'error';
      if (filter.outcome === 'error' && !isError) return false;
      if (filter.outcome === 'success' && isError) return false;
    }
    if (filter.search) {
      const needle = filter.search.trim().toLocaleLowerCase('ru-RU');
      const haystack = [
        log.userName, log.userId, log.details, log.newValue, log.oldValue,
        log.field, getRequestPath(log), module, ACTION_LABELS[log.action] || log.action,
      ].join(' ').toLocaleLowerCase('ru-RU');
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const uniqueActions = [...new Set(visibleLog.map(log => log.action))].sort();
  const toggleRow = (id: string) => setExpandedRows(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const resetFilters = () => setFilter({ action: '', search: '', module: '', outcome: '' });
  const handleClearAudit = async () => {
    if (!window.confirm('Очистить журнал аудита? Старые записи будут удалены. Событие очистки останется в журнале.')) return;
    setClearingAudit(true);
    try {
      const deletedCount = await clearAuditLog();
      alert(`Журнал очищен. Удалено записей: ${deletedCount}.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось очистить журнал аудита');
    } finally {
      setClearingAudit(false);
    }
  };
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? { date: '—', time: '—' } : {
      date: date.toLocaleDateString('ru-RU'),
      time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  };

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Аудит действий</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredLog.length === visibleLog.length
              ? `Записей: ${visibleLog.length}`
              : `Показано ${filteredLog.length} из ${visibleLog.length}`}
          </p>
        </div>
        {hasPermission('clear_audit') ? (
          <button type="button" onClick={handleClearAudit} disabled={clearingAudit} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
            <Trash2 size={16} /> {clearingAudit ? 'Очистка…' : 'Очистить журнал'}
          </button>
        ) : (
          <span className="text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
            Журнал доступен только для чтения
          </span>
        )}
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Подсистема</span>
            <select value={filter.module} onChange={e => setFilter({ ...filter, module: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              <option value="">Все подсистемы</option>
              {['Авторизация', 'Объекты', 'Комментарии', 'Справочник ТУ', 'Справочник магазинов', 'Роли', 'Настройки', 'Планировщик', 'Система'].map(module => <option key={module} value={module}>{module}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Тип действия</span>
            <select value={filter.action} onChange={e => setFilter({ ...filter, action: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              <option value="">Все действия</option>
              {uniqueActions.map(action => <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Результат</span>
            <select value={filter.outcome} onChange={e => setFilter({ ...filter, outcome: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              <option value="">Любой результат</option>
              <option value="success">Успешно</option>
              <option value="error">Ошибка</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Поиск по журналу</span>
            <span className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Пользователь, объект, маршрут…" className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400" />
            </span>
          </label>
        </div>
        <div className="flex justify-end mt-3">
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            <RotateCcw size={14} /> Сбросить фильтры
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
        <div className="overflow-auto max-h-[calc(100vh-340px)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-3 w-8"></th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">Дата и время</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Подсистема</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Действие</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 dark:text-gray-300">Пользователь</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 dark:text-gray-300 min-w-[220px]">Описание / запрос</th>
              </tr>
            </thead>
            <tbody>
              {filteredLog.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">По заданным фильтрам записей нет</td></tr>
              ) : filteredLog.map(log => {
                const { date, time } = formatDate(log.timestamp);
                const details = parseDetails(log.details);
                const module = getModule(log);
                const isExpanded = expandedRows.has(log.id);
                const project = log.storeId ? projects.find(item => item.id === log.storeId) : undefined;
                const statusCode = Number(details.statusCode || 0);
                const isError = statusCode >= 400 || details.outcome === 'error';
                const requestPath = getRequestPath(log);
                return (
                  <React.Fragment key={log.id}>
                    <tr className={`border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/60 ${isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onClick={() => toggleRow(log.id)}>
                      <td className="px-3 py-3 text-gray-400">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-700 dark:text-gray-200"><div>{date}</div><div className="text-gray-500 dark:text-gray-400">{time}</div></td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded px-2 py-1 text-xs whitespace-nowrap ${MODULE_COLORS[module] || MODULE_COLORS['Система']}`}>{module}</span></td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded px-2 py-1 text-xs whitespace-nowrap ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{getActionLabel(log)}</span>{log.action === 'api_request' && statusCode > 0 && <span className={`ml-1 text-xs ${isError ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>{statusCode}</span>}</td>
                      <td className="px-3 py-3 text-xs font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">{log.userName || (log.userId ? log.userId : 'Система')}</td>
                      <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-200 break-words">{requestPath ? <><span className="font-mono">{requestPath}</span>{log.details && <p className="mt-1 text-gray-500 dark:text-gray-400 line-clamp-2">{details.outcome === 'error' ? 'Запрос завершился ошибкой' : 'Запрос к API'}</p>}</> : (log.details || log.field || '—')}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ID события</p><p className="text-xs font-mono break-all text-gray-800 dark:text-gray-100">{log.id}</p></div>
                            <div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ID пользователя</p><p className="text-xs font-mono break-all text-gray-800 dark:text-gray-100">{log.userId || 'Система'}</p></div>
                            <div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Полная дата и время</p><p className="text-xs text-gray-800 dark:text-gray-100">{new Date(log.timestamp).toLocaleString('ru-RU')}</p></div>
                            {log.storeId && <div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ID объекта</p><p className="text-xs font-mono break-all text-gray-800 dark:text-gray-100">{log.storeId}</p>{project && <p className="text-xs mt-1 text-gray-700 dark:text-gray-200">Магазин №{project.storeNumber} — {project.address}</p>}</div>}
                            {log.field && <div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Изменённое поле</p><p className="text-xs text-gray-800 dark:text-gray-100">{log.field}</p></div>}
                            {details.statusCode !== undefined && <div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Результат HTTP</p><p className={`text-xs font-medium ${isError ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>{statusCode} · {isError ? 'Ошибка' : 'Успешно'}</p></div>}
                            {typeof details.ip === 'string' && <div><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">IP-адрес</p><p className="text-xs font-mono break-all text-gray-800 dark:text-gray-100">{details.ip || '—'}</p></div>}
                            {typeof details.userAgent === 'string' && <div className="md:col-span-2"><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">User-Agent</p><p className="text-xs break-all text-gray-800 dark:text-gray-100">{details.userAgent || '—'}</p></div>}
                            {(log.oldValue || log.newValue) && <div className="md:col-span-2 xl:col-span-3"><p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Изменение данных</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div className="rounded-lg border border-red-200 dark:border-red-900/70 p-3"><p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Было</p><pre className="text-xs whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">{log.oldValue || '—'}</pre></div><div className="rounded-lg border border-green-200 dark:border-green-900/70 p-3"><p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Стало</p><pre className="text-xs whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">{log.newValue || '—'}</pre></div></div></div>}
                            {details.payload !== undefined && <div className="md:col-span-2 xl:col-span-3"><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Данные запроса (секреты замаскированы)</p><pre className="text-xs whitespace-pre-wrap break-all rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-gray-800 dark:text-gray-100">{JSON.stringify(details.payload, null, 2)}</pre></div>}
                            {log.details && !Object.keys(details).length && <div className="md:col-span-2 xl:col-span-3"><p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Подробности</p><pre className="text-xs whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">{log.details}</pre></div>}
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
      </section>
    </div>
  );
}
