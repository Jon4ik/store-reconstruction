import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Edit2, Trash2, Phone, Mail, Check, RefreshCw } from 'lucide-react';
import { validatePhone, validateEmail } from '../utils/validation';
import PhoneInput from '../components/PhoneInput';
import { apiClient } from '../api/client';

export default function TUsPage() {
  const { tus, projects, addTU, updateTU, deleteTU, loadTUs, hasPermission } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTU, setNewTU] = useState({ fullName: '', position: 'Территориальный управляющий', phone: '', email: '', isActive: true });
  const [editData, setEditData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ldapConfigured, setLdapConfigured] = useState(false);
  const [syncingAD, setSyncingAD] = useState(false);

  useEffect(() => {
    apiClient.getLdapStatus().then(status => setLdapConfigured(status.configured)).catch(() => setLdapConfigured(false));
  }, []);

  const handleSyncAD = async () => {
    setSyncingAD(true);
    try {
      const result = await apiClient.syncTUsFromAD();
      await loadTUs();
      alert(`Синхронизация AD завершена. Найдено: ${result.found}, добавлено: ${result.created}, обновлено: ${result.updated}, отключено: ${result.disabled}, пропущено: ${result.skipped}.`);
    } catch (error) {
      alert('Не удалось синхронизировать AD: ' + (error as Error).message);
    } finally { setSyncingAD(false); }
  };

  if (!hasPermission('manage_tus')) {
    return <div className="text-center py-12 text-gray-500">Нет доступа к этой странице</div>;
  }

  const filteredTUs = tus.filter(tu => 
    tu.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tu.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tu.phone && tu.phone.includes(searchQuery)) ||
    (tu.email && tu.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getProjectCount = (tuId: string) => projects.filter(p => p.tuId === tuId && !p.isDeleted).length;

  const handleAdd = () => {
    if (!newTU.fullName) {
      alert('Укажите ФИО');
      return;
    }
    if (!validateEmail(newTU.email)) {
      alert('Некорректный формат email. Пример: zotov@company.ru');
      return;
    }
    addTU(newTU);
    setNewTU({ fullName: '', position: 'Территориальный управляющий', phone: '', email: '', isActive: true });
    setShowAddForm(false);
  };

  const startEdit = (tu: any) => {
    setEditingId(tu.id);
    setEditData({ fullName: tu.fullName, position: tu.position, phone: tu.phone || '', email: tu.email || '', isActive: tu.isActive });
  };

  const saveEdit = () => {
    if (editingId && editData) {
      if (!editData.fullName) {
        alert('Укажите ФИО');
        return;
      }
      if (!validateEmail(editData.email)) {
        alert('Некорректный формат email. Пример: zotov@company.ru');
        return;
      }
      updateTU(editingId, editData);
      setEditingId(null);
      setEditData(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const success = await deleteTU(id);
      if (!success) {
        alert('Нельзя удалить ТУ, который назначен на активные объекты');
      }
    } catch (error) {
      console.error('Failed to delete TU:', error);
      alert('Ошибка при удалении ТУ');
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Справочник ТУ</h1>
          <p className="text-sm text-gray-500 mt-1">Территориальные управляющие, назначаемые на объекты</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleSyncAD} disabled={!ldapConfigured || syncingAD} title={ldapConfigured ? 'Синхронизировать ТУ с Active Directory' : 'Сначала заполните настройки LDAP'} className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <RefreshCw size={16} className={syncingAD ? 'animate-spin' : ''} /> {syncingAD ? 'Синхронизация...' : 'Синхронизировать с AD'}
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> Добавить ТУ
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Поиск по ФИО, должности, телефону, email..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Новый ТУ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ФИО *</label>
              <input type="text" value={newTU.fullName} onChange={e => setNewTU({ ...newTU, fullName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Зотов Денис" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Должность</label>
              <input type="text" value={newTU.position} onChange={e => setNewTU({ ...newTU, position: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Телефон</label>
              <PhoneInput
                value={newTU.phone}
                onChange={value => setNewTU({ ...newTU, phone: value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input type="email" value={newTU.email} onChange={e => setNewTU({ ...newTU, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="mail@mail.ru" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Статус</label>
              <select value={newTU.isActive ? 'active' : 'inactive'} onChange={e => setNewTU({ ...newTU, isActive: e.target.value === 'active' })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={handleAdd} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Создать</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Отмена</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ФИО</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Должность</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Телефон</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Объектов</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Статус</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredTUs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {searchQuery ? 'Ничего не найдено' : 'Нет записей'}
                </td>
              </tr>
            ) : filteredTUs.map(tu => {
              const isEditing = false;
              const projectCount = getProjectCount(tu.id);
              return (
                <tr key={tu.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {isEditing ? (
                    <>
                      <td className="px-4 py-3"><input type="text" value={editData.fullName} onChange={e => setEditData({ ...editData, fullName: e.target.value })} className="px-2 py-1 border border-gray-200 rounded text-sm w-full" /></td>
                      <td className="px-4 py-3"><input type="text" value={editData.position} onChange={e => setEditData({ ...editData, position: e.target.value })} className="px-2 py-1 border border-gray-200 rounded text-sm w-full" /></td>
                      <td className="px-4 py-3">
                        <PhoneInput
                          value={editData.phone}
                          onChange={value => setEditData({ ...editData, phone: value })}
                          className="px-2 py-1 border border-gray-200 rounded text-sm w-full"
                        />
                      </td>
                      <td className="px-4 py-3"><input type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className="px-2 py-1 border border-gray-200 rounded text-sm w-full" placeholder="mail@mail.ru" /></td>
                      <td className="px-4 py-3 text-gray-500">{projectCount}</td>
                      <td className="px-4 py-3">
                        <select value={editData.isActive ? 'active' : 'inactive'} onChange={e => setEditData({ ...editData, isActive: e.target.value === 'active' })} className="px-2 py-1 border border-gray-200 rounded text-sm">
                          <option value="active">Активен</option>
                          <option value="inactive">Неактивен</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded text-xs font-medium">Сохранить</button>
                          <button onClick={() => { setEditingId(null); setEditData(null); }} className="text-gray-600 hover:bg-gray-100 p-1 rounded text-xs">Отмена</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-900">{tu.fullName}</td>
                      <td className="px-4 py-3 text-gray-600">{tu.position}</td>
                      <td className="px-4 py-3 text-gray-600">{tu.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{tu.email || '—'}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{projectCount}</span></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${tu.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {tu.isActive ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(tu)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16} /></button>
                          {deleteConfirm === tu.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(tu.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Да</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-xs border border-gray-200 px-2 py-1 rounded">Нет</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(tu.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editingId && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e=>{if(e.target===e.currentTarget){setEditingId(null);setEditData(null)}}}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-tu-title" className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h2 id="edit-tu-title" className="mb-5 text-lg font-semibold text-gray-900">Редактирование ТУ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="mb-1 block text-xs font-medium text-gray-600">ФИО *</label><input value={editData.fullName} onChange={e=>setEditData({...editData,fullName:e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"/></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Должность</label><input value={editData.position} onChange={e=>setEditData({...editData,position:e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"/></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Телефон</label><PhoneInput value={editData.phone} onChange={value=>setEditData({...editData,phone:value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"/></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Email</label><input type="email" value={editData.email} onChange={e=>setEditData({...editData,email:e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"/></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Статус</label><select value={editData.isActive?'active':'inactive'} onChange={e=>setEditData({...editData,isActive:e.target.value==='active'})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="active">Активен</option><option value="inactive">Отключён</option></select></div>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button onClick={()=>{setEditingId(null);setEditData(null)}} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Отмена</button><button onClick={saveEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Сохранить</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
