import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Store, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

type Shop = { id: string; shopNumber: string; city: string; address: string; workHours: string; areaManager: string; areaManagerPhone: string; tu: string; directorate: string };

export default function ShopsPage() {
  const { hasPermission } = useStore();
  const [shops, setShops] = useState<Shop[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.getShops({ search: search.trim(), limit: 500 });
      setShops(result.data || []);
    } catch (e) {
      setMessage('Не удалось загрузить справочник: ' + (e as Error).message);
      setError(true);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  const sync = async () => {
    setSyncing(true); setMessage(''); setError(false);
    try {
      const result = await apiClient.syncShops();
      setMessage('Синхронизация завершена. Источник: ' + result.sourceCount + ', добавлено: ' + result.created + ', обновлено: ' + result.updated + ', без изменений: ' + result.unchanged + '. Удалений: 0.');
      await load();
    } catch (e) { setMessage('Ошибка синхронизации: ' + (e as Error).message); setError(true); }
    finally { setSyncing(false); }
  };

  if (!hasPermission('view_shops')) return <div className="py-12 text-center text-gray-500">Нет доступа к справочнику магазинов</div>;

  return <div className="max-w-full space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Store size={24}/>Справочник магазинов</h1><p className="mt-1 text-sm text-gray-500">Данные синхронизируются из SQL Server и хранятся в PostgreSQL.</p></div>
      {hasPermission('manage_shops') && <button onClick={sync} disabled={syncing} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><RefreshCw size={16} className={syncing ? 'animate-spin' : ''}/>{syncing ? 'Синхронизация…' : 'Синхронизировать сейчас'}</button>}
    </div>
    {message && <div role="status" aria-live="polite" className={'rounded-lg border p-3 text-sm ' + (error ? 'border-red-300 bg-red-50 text-red-800' : 'border-green-300 bg-green-50 text-green-800')}>{error ? <AlertTriangle size={16} className="mr-2 inline"/> : <CheckCircle2 size={16} className="mr-2 inline"/>}{message}</div>}
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <label className="relative block max-w-xl"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по номеру, городу, адресу, УМ или ТУ" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"/></label>
      <div className="mt-4 text-xs text-gray-500">Найдено: {shops.length}{shops.length === 500 ? '+' : ''}</div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500"><th className="px-3 py-3">№ магазина</th><th className="px-3 py-3">Город</th><th className="px-3 py-3">Адрес</th><th className="px-3 py-3">Время работы</th><th className="px-3 py-3">УМ</th><th className="px-3 py-3">Телефон УМ</th><th className="px-3 py-3">ТУ</th><th className="px-3 py-3">Дирекция</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-500">Загрузка…</td></tr> : shops.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-500">Магазины не найдены. Проверьте поиск или выполните синхронизацию.</td></tr> : shops.map(shop=><tr key={shop.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50"><td className="px-3 py-3 font-semibold text-gray-900">{shop.shopNumber}</td><td className="px-3 py-3 text-gray-700">{shop.city || '—'}</td><td className="px-3 py-3 text-gray-700">{shop.address}</td><td className="px-3 py-3 text-gray-700">{shop.workHours || '—'}</td><td className="px-3 py-3 text-gray-700">{shop.areaManager || '—'}</td><td className="px-3 py-3 text-gray-700">{shop.areaManagerPhone || '—'}</td><td className="px-3 py-3 text-gray-700">{shop.tu || '—'}</td><td className="px-3 py-3 text-gray-700">{shop.directorate || '—'}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}
