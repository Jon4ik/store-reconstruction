import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Play, Save, CheckCircle2, AlertTriangle, Clock3 } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

type Task = { id: string; name: string; cronExpression: string; enabled: boolean; lastRunAt: string | null; lastStatus: string; lastMessage: string };

export default function SchedulerPage() {
  const { hasPermission } = useStore();
  const [task, setTask] = useState<Task | null>(null);
  const [cronExpression, setCronExpression] = useState('0 0 * * *');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tasks = await apiClient.getSchedulerTasks();
      const current = tasks.find((item: Task) => item.id === 'shops-sync') || tasks[0];
      if (current) { setTask(current); setCronExpression(current.cronExpression); setEnabled(current.enabled); }
    } catch (e) { setMessage('Не удалось загрузить планировщик: ' + (e as Error).message); setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!hasPermission('manage_scheduler')) return <div className="py-12 text-center text-gray-500">Нет доступа к планировщику</div>;

  const save = async () => {
    if (!task) return;
    setSaving(true); setMessage(''); setError(false);
    try { const updated = await apiClient.updateSchedulerTask(task.id, { enabled, cronExpression: cronExpression.trim() }); setTask(updated); setMessage('Параметры задачи сохранены.'); }
    catch (e) { setMessage('Ошибка сохранения: ' + (e as Error).message); setError(true); }
    finally { setSaving(false); }
  };

  const run = async () => {
    if (!task) return;
    setRunning(true); setMessage(''); setError(false);
    try { const result = await apiClient.runSchedulerTask(task.id); setMessage('Синхронизация завершена: добавлено ' + result.created + ', обновлено ' + result.updated + ', без изменений ' + result.unchanged + '.'); await load(); }
    catch (e) { setMessage('Ошибка запуска задачи: ' + (e as Error).message); setError(true); await load(); }
    finally { setRunning(false); }
  };

  return <div className="max-w-6xl space-y-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><CalendarClock size={24}/>Планировщик (crontab)</h1><p className="mt-1 text-sm text-gray-500 dark-readable-muted">Автоматический запуск фоновых задач по расписанию сервера.</p></div>
    {message && <div role="status" aria-live="polite" className={'rounded-lg border p-3 text-sm ' + (error ? 'border-red-300 bg-red-50 text-red-800' : 'border-green-300 bg-green-50 text-green-800')}>{error ? <AlertTriangle size={16} className="mr-2 inline"/> : <CheckCircle2 size={16} className="mr-2 inline"/>}{message}</div>}
    {loading ? <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Загрузка задач…</div> : task ? <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <div><h2 className="text-lg font-semibold text-gray-900">{task.name}</h2><p className="mt-1 text-sm text-gray-500">Синхронизирует источник SQL Server с таблицей магазинов PostgreSQL. Новые записи добавляются, изменённые обновляются; отсутствующие в источнике не удаляются.</p></div>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"><span><span className="block text-sm font-medium text-gray-900">Автоматическая синхронизация</span><span className="mt-1 block text-xs text-gray-500">Задача выполняется по расписанию, если переключатель включён.</span></span><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} className="h-5 w-5"/></label>
        <div><label className="mb-1 block text-sm font-medium text-gray-800">Crontab-выражение</label><input value={cronExpression} onChange={e=>setCronExpression(e.target.value)} placeholder="0 0 * * *" className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"/><p className="mt-1 text-xs text-gray-500">По умолчанию: 0 0 * * * — ежедневно в 00:00 по локальному времени сервера. Формат: минута час день месяц день-недели. Примеры: <code>0 0 * * *</code> — каждый день в 00:00; <code>30 8 * * 1-5</code> — по будням в 08:30; <code>*/15 * * * *</code> — каждые 15 минут. Символы: <code>*</code> — любое значение, <code>*/N</code> — каждый N-й интервал, <code>1-5</code> — диапазон, <code>1,3,5</code> — перечисление. Время берётся из часового пояса сервера.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Save size={16}/>{saving ? 'Сохранение…' : 'Сохранить настройки'}</button><button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Play size={16}/>{running ? 'Выполнение…' : 'Запустить сейчас'}</button></div>
      </section>
      <aside className="rounded-xl border border-blue-100 bg-blue-50 p-6 space-y-4 dark-readable-panel"><h3 className="font-semibold text-blue-950 dark-readable-heading">Как работает планировщик</h3><ul className="list-disc space-y-2 pl-5 text-sm text-blue-900 dark-readable-copy"><li>Проверка расписания выполняется сервером API каждые 30 секунд.</li><li>Для расписания используется часовой пояс сервера, а не браузера.</li><li>Статус, время последнего запуска и результат сохраняются в PostgreSQL.</li><li>Подключение к SQL Server задаётся через переменные UKM_SQL_* в окружении backend.</li><li>Для ручного запуска используйте кнопку здесь или синхронизацию на странице справочника магазинов.</li></ul><div className="border-t border-blue-200 pt-4 text-sm"><p className="font-medium text-blue-950 dark-readable-heading">Последний запуск</p><p className="mt-1 flex items-center gap-2 text-blue-900 dark-readable-copy"><Clock3 size={15}/>{task.lastRunAt ? new Date(task.lastRunAt).toLocaleString() : 'Ещё не запускалась'}</p><p className="mt-2 text-blue-900 dark-readable-copy">Статус: {task.lastStatus === 'success' ? 'Успешно' : task.lastStatus === 'error' ? 'Ошибка' : task.lastStatus === 'running' ? 'Выполняется' : 'Нет запусков'}</p>{task.lastMessage && <p className="mt-1 break-words text-xs text-blue-800 dark-readable-copy">{task.lastMessage}</p>}</div></aside>
    </div> : <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Нет настроенных задач.</div>}
  </div>;
}
