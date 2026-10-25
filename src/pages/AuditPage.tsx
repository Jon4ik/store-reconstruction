import { getAuditErrorReason } from '../utils/auditError';
import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, ChevronUp, Search, RotateCcw, Trash2 } from 'lucide-react';
import AuditEventDetails from '../components/AuditEventDetails';
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
  if (action === 'notification_delivery' || route.includes('/notifications')) return 'Уведомления';
  if (route.includes('/ldap') || route.includes('/integrations')) return 'Настройки';
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
  notification_delivery: 'Обработка уведомления',
};

function getActionLabel(log: AuditLogEntry): string {
  if (log.action === 'api_request') {
    const request = String(log.newValue || '');
    const method = request.split(/\s+/)[0]?.toUpperCase();
    const route = getRequestPath(log).toLowerCase();
    if (route.includes('/auth/logout')) return 'Выход из системы';
    if (route.includes('/notifications')) return method === 'POST' ? 'Создание правила уведомления' : method === 'PUT' ? 'Изменение правила уведомления' : method === 'DELETE' ? 'Удаление правила уведомления' : 'Запрос к уведомлениям';
    if (route.includes('/scheduler/tasks') && method === 'PUT') return 'Изменение расписания';
    if (route.includes('/scheduler/tasks') && method === 'POST') return 'Ручной запуск задачи';
    if (route.includes('/shops')) return method === 'POST' ? 'Добавление магазина' : method === 'PUT' ? 'Изменение магазина' : method === 'DELETE' ? 'Удаление магазина' : 'Запрос к справочнику магазинов';
    if (route.includes('/stores')) return method === 'POST' ? 'Создание объекта' : method === 'PUT' || method === 'PATCH' ? 'Изменение объекта' : method === 'DELETE' ? 'Удаление объекта' : 'Запрос к объектам';
    if (route.includes('/roles')) return method === 'POST' ? 'Создание роли' : method === 'PUT' ? 'Изменение роли' : method === 'DELETE' ? 'Удаление роли' : 'Запрос к ролям';
    if (route.includes('/ldap') || route.includes('/integrations')) return 'Изменение настроек интеграции';
  }
  if (log.action === 'notification_delivery') {
    const details = parseDetails(log.details);
    const outcome = details.outcome === 'success' ? 'Успешно' : 'Ошибка';
    return `Отправка уведомления — ${outcome}`;
  }
  return ACTION_LABELS[log.action] || log.action;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-green-100 text-green-800',
  logout: 'bg-gray-100 text-gray-700',
  clear_audit: 'bg-red-100 text-red-800',
  create: 'bg-blue-100 text-blue-800',
  update: 'bg-amber-100 text-amber-800',
  delete: 'bg-red-100 text-red-800',
  restore: 'bg-teal-100 text-teal-800',
  change_color: 'bg-fuchsia-100 text-fuchsia-800',
  api_request: 'bg-slate-100 text-slate-700',
  scheduler_run: 'bg-orange-100 text-orange-800',
  notification_delivery: 'bg-violet-100 text-violet-800',
};

const MODULE_COLORS: Record<string, string> = {
  'Авторизация': 'bg-green-100 text-green-800',
  'Аудит': 'bg-red-100 text-red-800',
  'Объекты': 'bg-blue-100 text-blue-800',
  'Комментарии': 'bg-indigo-100 text-indigo-800',
  'Справочник ТУ': 'bg-emerald-100 text-emerald-800',
  'Роли': 'bg-purple-100 text-purple-800',
  'Настройки': 'bg-cyan-100 text-cyan-800',
  'Планировщик': 'bg-orange-100 text-orange-800',
  'Уведомления': 'bg-violet-100 text-violet-800',
  'Справочник магазинов': 'bg-teal-100 text-teal-800',
  'Система': 'bg-gray-100 text-gray-700',
};

export default function AuditPage() {
  const { auditLog, hasPermission, projects, tus, clearAuditLog } = useStore();
  const [filter, setFilter] = useState({ action: '', search: '', module: '', outcome: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => { setPage(1); }, [filter.action, filter.search, filter.module, filter.outcome, pageSize]);
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
        log.field, getRequestPath(log), module, getActionLabel(log), ACTION_LABELS[log.action] || log.action,
      ].join(' ').toLocaleLowerCase('ru-RU');
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pageCount = Math.max(1, Math.ceil(filteredLog.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedLog = filteredLog.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const errorCount = visibleLog.filter(log => { const details = parseDetails(log.details); return Number(details.statusCode || 0) >= 400 || details.outcome === 'error'; }).length;
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
    <div className="audit-page space-y-5 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Журнал аудита</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredLog.length === visibleLog.length
              ? `Записей: ${visibleLog.length}`
              : `Показано ${filteredLog.length} из ${visibleLog.length}`}
          </p>
        </div>
        {hasPermission('clear_audit') ? (
          <button type="button" onClick={handleClearAudit} disabled={clearingAudit} className="inline-flex items-center justify-center gap-2 audit-clear rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            <Trash2 size={16} /> {clearingAudit ? 'Очистка…' : 'Очистить журнал'}
          </button>
        ) : (
          <span className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2">
            Журнал доступен только для чтения
          </span>
        )}
      </div>

      <div className="audit-overview">
        <div><span>Загружено событий</span><strong>{visibleLog.length}</strong></div>
        <div><span>Ошибки</span><strong className={errorCount ? 'text-red-600' : ''}>{errorCount}</strong></div>
        <div><span>Участники</span><strong>{new Set(visibleLog.map(log => log.userId || log.userName)).size}</strong></div>
        <p>Кто, что и когда изменил.<br/>Нажмите на событие для просмотра деталей.</p>
      </div>
      <section className="audit-toolbar bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Подсистема</span>
            <select value={filter.module} onChange={e => setFilter({ ...filter, module: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900">
              <option value="">Все подсистемы</option>
              {['Авторизация', 'Объекты', 'Комментарии', 'Справочник ТУ', 'Справочник магазинов', 'Роли', 'Настройки', 'Уведомления', 'Планировщик', 'Система'].map(module => <option key={module} value={module}>{module}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Тип действия</span>
            <select value={filter.action} onChange={e => setFilter({ ...filter, action: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900">
              <option value="">Все действия</option>
              {uniqueActions.map(action => <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Результат</span>
            <select value={filter.outcome} onChange={e => setFilter({ ...filter, outcome: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900">
              <option value="">Любой результат</option>
              <option value="success">Успешно</option>
              <option value="error">Ошибка</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Поиск по журналу</span>
            <span className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} placeholder="Пользователь, объект, маршрут…" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400" />
            </span>
          </label>
        </div>
        <div className="flex justify-end mt-3">
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900">
            <RotateCcw size={14} /> Сбросить фильтры
          </button>
        </div>
      </section>

      <section className="audit-table-shell bg-white rounded-xl border border-gray-200 overflow-hidden min-w-0">
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-3 w-8"></th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap">Дата и время</th>

                <th className="text-left px-3 py-3 font-medium text-gray-600">Событие</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">Пользователь</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 min-w-[220px]">Содержание события</th>
              </tr>
            </thead>
            <tbody>
              {filteredLog.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">По заданным фильтрам записей нет</td></tr>
              ) : pagedLog.map(log => {
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
                    <tr className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`} onClick={() => toggleRow(log.id)}>
                      <td className="px-3 py-3 text-gray-400"><button type="button" aria-label="Подробности события" aria-expanded={isExpanded} onClick={e => { e.stopPropagation(); toggleRow(log.id); }} className="audit-expand">{isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button></td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-700"><div>{date}</div><div className="text-gray-500">{time}</div></td>

                      <td className="px-3 py-3"><span className={`inline-flex rounded px-2 py-1 text-xs audit-action`}>{getActionLabel(log)}</span><p className="audit-event-module">{module}</p>{log.action === 'api_request' && statusCode > 0 && <span className={`ml-1 text-xs ${isError ? 'text-red-600' : 'text-green-700'}`}>{statusCode}</span>}</td>
                      <td className="px-3 py-3 text-xs font-medium text-gray-800">{log.userName || (log.userId ? log.userId : 'Система')}</td>
                      <td className="px-3 py-3 text-xs text-gray-700 break-words">{log.action === 'notification_delivery' ? <><span className="font-medium">{String(details.ruleName || 'Уведомление')}</span><p className="mt-1 text-gray-500">Магазин №{String(details.shopNumber || '—')} · {String(details.message || '')}</p></> : requestPath ? <><span>{isError ? 'Не удалось выполнить действие' : 'Операция выполнена успешно'}</span>{log.details && <p className="mt-1 text-gray-500 line-clamp-2">{isError ? getAuditErrorReason(details) : 'Запрос выполнен'}</p>}</> : <><span>{log.details || log.field || '—'}</span>{(log.action === 'update' || log.action === 'change_color') && <p className="audit-change-preview"><span>{log.oldValue || 'Не задано'}</span> → <strong>{log.newValue || 'Не задано'}</strong></p>}{project && <p className="audit-object">Магазин №{project.storeNumber}</p>}</>}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td colSpan={5} className="px-4 py-4">
                          <AuditEventDetails log={log} title={getActionLabel(log)} module={module} projects={projects} tus={tus} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="audit-pagination">
          <span>{filteredLog.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredLog.length)} из {filteredLog.length} событий</span>
          <label>На странице <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
          <div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Назад</button><span>{currentPage} / {pageCount}</span><button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Далее</button></div>
        </footer>
      </section>
    </div>
  );
}
