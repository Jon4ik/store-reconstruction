import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Plus, Pencil, Trash2, X, Save, Loader2, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

type Rule = {
  id: string; name: string; offsetType: 'calendar_days' | 'business_days'; eventType: string;
  days: number; channel: 'intradesk' | 'telegram' | 'pachca'; enabled: boolean; sendTime: string;
  messageTemplate: string; intradeskGroup: string; intradeskService: string; intradeskSubject: string; intradeskTaskType: string; intradeskTags: string;
  pachcaTargetType: 'channel' | 'direct'; pachcaEntityId: string; pachcaRecipientId: string; emailTo: string; emailSubject: string;
};
type FormData = Omit<Rule, 'id'>;
const blankForm: FormData = {
  name: '', offsetType: 'calendar_days', eventType: 'closureDate', days: 1,
  channel: 'intradesk', enabled: true, sendTime: '09:00', messageTemplate: '',
  intradeskGroup: '', intradeskService: '', intradeskSubject: '', intradeskTaskType: '', intradeskTags: '',
  pachcaTargetType: 'channel', pachcaEntityId: '', pachcaRecipientId: '', emailTo: '', emailSubject: '',
};
const events: Record<string, string> = {
  closureDate: 'Закрытие для покупателей', demolitionDate: 'Демонтаж',
  installationDate: 'Монтаж', techOpenDate: 'Техническое открытие',
};
const offsetLabels: Record<string, string> = {
  calendar_days: 'За N дней до событий', business_days: 'За N рабочих дней до событий',
};

export default function NotificationsPage() {
  const { hasPermission } = useStore();
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState<FormData>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [pachcaEnabled, setPachcaEnabled] = useState(false);
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.getNotificationRules();
      setRules(data);
    } catch (e) { setError((e as Error).message || 'Не удалось загрузить уведомления'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!hasPermission('view_notifications')) { setLoading(false); return; }
    void load();
    Promise.all([apiClient.getIntraDeskSettings(), apiClient.getPachcaSettings(), apiClient.getSmtpSettings()]).then(([intra,pachca,smtp]) => { setIntegrationEnabled(Boolean(intra.enabled)); setPachcaEnabled(Boolean(pachca.enabled)); setSmtpEnabled(Boolean(smtp.enabled)); }).catch(() => { setIntegrationEnabled(false); setPachcaEnabled(false); setSmtpEnabled(false); });
  }, [hasPermission, load]);

  if (!hasPermission('view_notifications')) return <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">Нет доступа к этой странице</div>;

  const canCreate = hasPermission('create_notifications');
  const canEdit = hasPermission('edit_notifications');
  const canDelete = hasPermission('delete_notifications');
  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm(current => ({ ...current, [key]: value }));

  const startCreate = () => { setEditingId(null); setForm({ ...blankForm, channel: 'intradesk' }); setFormOpen(true); setError(''); setSuccess(''); };
  const startEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setFormOpen(true);
    const { id, ...values } = rule;
    setForm(values);
    setError(''); setSuccess('');
  };
  const cancel = () => { setEditingId(null); setForm(blankForm); setFormOpen(false); setError(''); };

  const save = async () => {
    setError(''); setSuccess('');
    if (!form.name.trim()) return setError('Укажите название уведомления.');
    if (!form.messageTemplate.trim()) return setError('Заполните текст уведомления.');
    if (form.channel === 'intradesk') {
      if (!integrationEnabled) return setError('Подключите интеграцию IntraDesk в разделе «Настройки → Интеграции».');
      if (!form.intradeskGroup.trim() || !form.intradeskService.trim() || !form.intradeskSubject.trim() || !form.intradeskTaskType.trim()) return setError('Заполните группу исполнителей, сервис, тип и тему заявки IntraDesk.');
      if (!/^\d+$/.test(form.intradeskGroup.trim()) || !/^\d+$/.test(form.intradeskTaskType.trim())) return setError('Группа исполнителей и тип заявки должны содержать числовые ID.');
      if (form.intradeskTags.trim() && !/^\d+(\s*,\s*\d+)*$/.test(form.intradeskTags.trim())) return setError('Теги укажите числовыми ID через запятую.');
    }
    if (form.channel === 'pachca') {
      if (!pachcaEnabled) return setError('Включите интеграцию Pachca в разделе «Настройки → Интеграции».');
      if (form.pachcaTargetType === 'channel' && !/^\d+$/.test(form.pachcaEntityId.trim())) return setError('Укажите числовой ID канала/чата Pachca.');
      if (form.pachcaTargetType === 'direct' && !/^\d+$/.test(form.pachcaRecipientId.trim())) return setError('Укажите числовой ID получателя Pachca.');
    }
    if (form.channel === 'smtp') {
      if (!smtpEnabled) return setError('Включите SMTP в разделе «Настройки → Интеграции».');
      if (!form.emailTo.trim() || !form.emailSubject.trim()) return setError('Для SMTP укажите адрес получателя и тему письма.');
    }
    setSaving(true);
    try {
      if (editingId) await apiClient.updateNotificationRule(editingId, form);
      else await apiClient.createNotificationRule(form);
      await load();
      setSuccess(editingId ? 'Уведомление сохранено.' : 'Уведомление добавлено.');
      cancel();
    } catch (e) { setError((e as Error).message || 'Не удалось сохранить уведомление'); }
    finally { setSaving(false); }
  };

  const toggle = async (rule: Rule) => {
    setError(''); setSuccess('');
    try {
      await apiClient.updateNotificationRule(rule.id, { enabled: !rule.enabled });
      await load();
      setSuccess(!rule.enabled ? 'Уведомление включено.' : 'Уведомление выключено.');
    } catch (e) { setError((e as Error).message || 'Не удалось изменить состояние уведомления'); }
  };

  const remove = async (rule: Rule) => {
    if (!window.confirm(`Полностью удалить уведомление «${rule.name}» из базы данных?`)) return;
    setError(''); setSuccess('');
    try {
      await apiClient.deleteNotificationRule(rule.id);
      setRules(current => current.filter(item => item.id !== rule.id));
      if (editingId === rule.id) cancel();
      setSuccess('Уведомление удалено из базы данных.');
    } catch (e) { setError((e as Error).message || 'Не удалось удалить уведомление'); }
  };

  const eventLabel = (rule: Rule) => `${offsetLabels[rule.offsetType].replace('N', String(rule.days))} · ${events[rule.eventType]}`;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BellRing size={22}/></div>
        <div><h1 className="text-2xl font-bold text-gray-900">Уведомления</h1><p className="mt-1 text-sm text-gray-500">Правила автоматической отправки по событиям магазинов</p></div>
      </div>
      {canCreate && <button onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17}/>Добавить уведомление</button>}
    </div>

    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {success && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

    {(canCreate || canEdit) && formOpen && (editingId ? canEdit : canCreate) && <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Редактирование уведомления' : 'Новое уведомление'}</h2>
        <button onClick={cancel} aria-label="Закрыть форму" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"><X size={18}/></button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700 md:col-span-2">Название уведомления
          <input value={form.name} onChange={e=>setField('name',e.target.value)} maxLength={120} placeholder="Например, подготовка к закрытию магазина" className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" disabled={Boolean(editingId && !canEdit)}/>
        </label>
        <label className="block text-sm font-medium text-gray-700">Событие — срок
          <select value={form.offsetType} onChange={e=>setField('offsetType',e.target.value as FormData['offsetType'])} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm">
            <option value="calendar_days">За N дней до событий</option>
            <option value="business_days">За N рабочих дней до событий</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">Событие магазина
          <select value={form.eventType} onChange={e=>setField('eventType',e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm">
            {Object.entries(events).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">Дней
          <input type="number" min={0} max={365} value={form.days} onChange={e=>setField('days',Math.max(0,Math.min(365,Number(e.target.value))))} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"/>
        </label>
        <label className="block text-sm font-medium text-gray-700">Время отправки
          <input type="time" value={form.sendTime} onChange={e=>setField('sendTime',e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"/>
        </label>
        <label className="block text-sm font-medium text-gray-700 md:col-span-2">Канал связи
          <select value={form.channel} onChange={e=>setField('channel',e.target.value as FormData['channel'])} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm">
            <option value="intradesk" disabled={!integrationEnabled}>IntraDesk{!integrationEnabled?' — интеграция не подключена':''}</option>
            <option value="pachca" disabled={!pachcaEnabled}>Pachca{!pachcaEnabled?' — интеграция не подключена':''}</option>
            <option value="smtp" disabled={!smtpEnabled}>SMTP / Email{!smtpEnabled?' — интеграция не подключена':''}</option>
          </select>
        </label>
        {form.channel === 'intradesk' && <div className="grid grid-cols-1 gap-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4 md:col-span-2 md:grid-cols-3">
          <label className="block text-sm font-medium text-gray-700">Группа исполнителей
            <input value={form.intradeskGroup} onChange={e=>setField('intradeskGroup',e.target.value)} maxLength={500} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
          </label>
          <label className="block text-sm font-medium text-gray-700">Сервис
            <input value={form.intradeskService} onChange={e=>setField('intradeskService',e.target.value)} maxLength={500} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
          </label>
          <label className="block text-sm font-medium text-gray-700">Тема заявки
            <input value={form.intradeskSubject} onChange={e=>setField('intradeskSubject',e.target.value)} maxLength={500} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
          </label>
          <label className="block text-sm font-medium text-gray-700">Тип заявки (ID)
            <input value={form.intradeskTaskType} onChange={e=>setField('intradeskTaskType',e.target.value)} inputMode="numeric" maxLength={20} placeholder="Например, 36283" className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
          </label>
          <label className="block text-sm font-medium text-gray-700 md:col-span-3">Теги IntraDesk (ID через запятую, необязательно)
            <input value={form.intradeskTags} onChange={e=>setField('intradeskTags',e.target.value)} maxLength={1000} placeholder="Например, 33290, 56899" className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
            <span className="mt-1 block text-xs text-gray-500">Укажите ID тегов из IntraDesk; если поле пустое, теги не передаются.</span>
          </label>
        </div>}
        {form.channel === 'pachca' && <div className="grid grid-cols-1 gap-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 md:col-span-2 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 md:col-span-2">Тип отправки
            <select value={form.pachcaTargetType} onChange={e=>setField('pachcaTargetType',e.target.value as FormData['pachcaTargetType'])} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="channel">В канал / групповой чат</option><option value="direct">Личное сообщение сотруднику</option></select>
          </label>
          {form.pachcaTargetType === 'channel' ? <label className="block text-sm font-medium text-gray-700 md:col-span-2">ID канала или чата Pachca
            <input value={form.pachcaEntityId} onChange={e=>setField('pachcaEntityId',e.target.value)} inputMode="numeric" maxLength={30} placeholder="Например, 334" className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
          </label> : <label className="block text-sm font-medium text-gray-700 md:col-span-2">ID сотрудника Pachca
            <input value={form.pachcaRecipientId} onChange={e=>setField('pachcaRecipientId',e.target.value)} inputMode="numeric" maxLength={30} placeholder="ID получателя личного сообщения" className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
            <span className="mt-1 block text-xs text-gray-500">Для личного сообщения интеграция создаёт личный чат через API Pachca.</span>
          </label>}
        </div>}
        {form.channel === 'smtp' && <div className="grid grid-cols-1 gap-4 rounded-lg border border-amber-100 bg-amber-50/50 p-4 md:col-span-2 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">Email получателя
            <input type="email" value={form.emailTo} onChange={e=>setField('emailTo',e.target.value)} maxLength={1000} placeholder="recipient@company.ru" className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
          </label>
          <label className="block text-sm font-medium text-gray-700">Тема письма
            <input value={form.emailSubject} onChange={e=>setField('emailSubject',e.target.value)} maxLength={1000} placeholder="Закрытие магазина №{shopNumber}" className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"/>
          </label>
        </div>}
        <label className="block text-sm font-medium text-gray-700 md:col-span-2">Текст уведомления
          <textarea value={form.messageTemplate} onChange={e=>setField('messageTemplate',e.target.value)} rows={Math.min(20, Math.max(5, form.messageTemplate.split('\n').length + Math.floor(form.messageTemplate.length / 90)))} maxLength={10000} placeholder="Введите текст уведомления. Используйте ключи из подсказки ниже." className="mt-1.5 w-full resize-none overflow-hidden rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
        </label>
        <div className="flex items-center gap-2 md:col-span-2">
          <input id="notification-enabled" type="checkbox" checked={form.enabled} onChange={e=>setField('enabled',e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600"/>
          <label htmlFor="notification-enabled" className="text-sm font-medium text-gray-700">Уведомление включено</label>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
        <div className="mb-2 flex items-center gap-2 font-semibold text-blue-950 dark:text-slate-100"><Info size={17}/>Ключи для подстановки в текст</div>
        <p className="mb-2 text-blue-900 dark:text-slate-300">Значения автоматически берутся из справочника магазинов, ТУ и дат объекта.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <p><code className="rounded bg-white px-1.5 py-0.5 text-slate-900 dark:bg-slate-700 dark:text-slate-100">{'{shopNumber}'}</code> — номер магазина из shop_directory</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{address}'}</code> — адрес магазина из shop_directory</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{tuFio}'}</code> — ФИО ТУ из tus.fullName</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{tuPhone}'}</code> — телефон ТУ из tus.phone</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{closureDate}'}</code> — дата закрытия для покупателей</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{days}'}</code> — число дней</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{daysText}'}</code> — число со склонением: 1 день, 2 дня, 5 дней</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{demolitionDate}'}</code> — дата демонтажа</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{installationDate}'}</code> — дата монтажа</p>
          <p><code className="rounded bg-white px-1.5 py-0.5">{'{techOpenDate}'}</code> — дата технического открытия</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button onClick={cancel} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Отмена</button>
        <button onClick={()=>void save()} disabled={saving || Boolean(editingId && !canEdit) || (!editingId && !canCreate)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>}Сохранить</button>
      </div>
    </section>}

    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Сохранённые уведомления</h2><span className="text-sm text-gray-500">{rules.length} шт.</span></div>
      {loading ? <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-10 text-gray-500"><Loader2 className="mr-2 animate-spin" size={18}/>Загрузка уведомлений…</div> :
      rules.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center"><BellRing className="mx-auto mb-3 text-gray-400" size={28}/><p className="font-medium text-gray-700">Уведомлений пока нет</p><p className="mt-1 text-sm text-gray-500">Добавьте первое правило отправки.</p></div> :
      rules.map(rule=><article key={rule.id} className={`rounded-xl border bg-white p-4 shadow-sm ${rule.enabled?'border-gray-200':'border-gray-200 opacity-70'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900">{rule.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${rule.enabled?'bg-green-100 text-green-800':'bg-gray-100 text-gray-600'}`}>{rule.enabled?'Включено':'Выключено'}</span></div>
            <p className="mt-1.5 text-sm text-gray-600">{eventLabel(rule)}</p>
            <p className="mt-1 text-sm text-gray-500">Канал: {{intradesk:'IntraDesk',pachca:'Pachca',smtp:'SMTP'}[rule.channel] || rule.channel} · Время отправки: {rule.sendTime}</p>
            {rule.channel === 'intradesk' && rule.intradeskSubject && <p className="mt-1 text-sm text-gray-500">Тема заявки: {rule.intradeskSubject}</p>}{rule.channel === 'smtp' && rule.emailSubject && <p className="mt-1 text-sm text-gray-500">Тема письма: {rule.emailSubject} · {rule.emailTo}</p>}
            <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{rule.messageTemplate}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canEdit && <button onClick={()=>void toggle(rule)} title={rule.enabled?'Выключить':'Включить'} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">{rule.enabled?<ToggleRight size={20}/>:<ToggleLeft size={20}/>}</button>}
            {canEdit && <button onClick={()=>startEdit(rule)} title="Редактировать" className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil size={17}/></button>}
            {canDelete && <button onClick={()=>void remove(rule)} title="Удалить из базы" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={17}/></button>}
          </div>
        </div>
      </article>)}
    </section>
  </div>;
}
