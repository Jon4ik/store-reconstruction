import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Edit2, Trash2, KeyRound } from 'lucide-react';

export default function UsersPage() {
  const { users, roles, addUser, updateUser, deleteUser, currentUser, hasPermission } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', fullName: '', roleId: roles[0]?.id || '', isActive: true });
  const [editData, setEditData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  if (!hasPermission('manage_users')) {
    return <div className="text-center py-12 text-gray-500">Нет доступа к этой странице</div>;
  }

  const handleAdd = () => {
    if (!newUser.username.trim()) {
      alert('Укажите логин');
      return;
    }
    if (!newUser.password.trim()) {
      alert('Укажите пароль');
      return;
    }
    if (newUser.password.length < 12) {
      alert('Пароль должен содержать минимум 12 символов');
      return;
    }
    if (!newUser.fullName.trim()) {
      alert('Укажите ФИО');
      return;
    }
    if (users.find(u => u.username === newUser.username.trim())) {
      alert(`Пользователь с логином "${newUser.username}" уже существует`);
      return;
    }
    addUser({ ...newUser, role: newUser.roleId });
    setNewUser({ username: '', password: '', fullName: '', roleId: roles[0]?.id || '', isActive: true });
    setShowAddForm(false);
  };

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setEditData({ username: user.username, fullName: user.fullName, roleId: user.role, isActive: user.isActive });
  };

  const saveEdit = async () => {
    if (editingId && editData) {
      if (!editData.username.trim()) {
        alert('Укажите логин');
        return;
      }
      if (!editData.fullName.trim()) {
        alert('Укажите ФИО');
        return;
      }
      // Проверяем уникальность логина (исключая текущего пользователя)
      if (users.find(u => u.username === editData.username.trim() && u.id !== editingId)) {
        alert(`Пользователь с логином "${editData.username}" уже существует`);
        return;
      }
      try {
        await updateUser(editingId, { ...editData, role: editData.roleId });
        setEditingId(null);
        setEditData(null);
      } catch (error) {
        console.error('Failed to update user:', error);
        alert('Ошибка при обновлении пользователя');
      }
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordUser) return;
    if (newPassword.length < 12 || newPassword.length > 128) {
      alert('Пароль должен содержать от 12 до 128 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }
    setSavingPassword(true);
    try {
      await updateUser(passwordUser.id, { password: newPassword } as any);
      setPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
      alert('Пароль пользователя изменён');
    } catch (error: any) {
      console.error('Failed to change user password:', error);
      alert(error?.message || 'Ошибка при изменении пароля');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const success = await deleteUser(id);
      if (!success) {
        alert('Нельзя удалить себя или последнего пользователя');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Ошибка при удалении пользователя');
    }
    setDeleteConfirm(null);
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    return role?.name || 'Не указана';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Пользователи системы</h1>
          <p className="text-sm text-gray-500 mt-1">Управление учётными записями для входа в систему</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Добавить пользователя
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Новый пользователь</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Логин *</label>
              <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="ivanov" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ФИО *</label>
              <input type="text" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Иванов И.И." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Пароль *</label>
              <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} minLength={12} maxLength={128} autoComplete="new-password" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Роль</label>
              <select value={newUser.roleId} onChange={e => setNewUser({ ...newUser, roleId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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
              <th className="text-left px-4 py-3 font-medium text-gray-500">Логин</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">ФИО</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Роль</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Статус</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const isEditing = false;
              return (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {isEditing ? (
                    <>
                      <td className="px-4 py-3"><input type="text" value={editData.username} onChange={e => setEditData({ ...editData, username: e.target.value })} className="px-2 py-1 border border-gray-200 rounded text-sm w-full" /></td>
                      <td className="px-4 py-3"><input type="text" value={editData.fullName} onChange={e => setEditData({ ...editData, fullName: e.target.value })} className="px-2 py-1 border border-gray-200 rounded text-sm w-full" /></td>
                      <td className="px-4 py-3">
                        <select value={editData.roleId} onChange={e => setEditData({ ...editData, roleId: e.target.value })} className="px-2 py-1 border border-gray-200 rounded text-sm">
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={editData.isActive ? 'active' : 'inactive'} onChange={e => setEditData({ ...editData, isActive: e.target.value === 'active' })} className="px-2 py-1 border border-gray-200 rounded text-sm">
                          <option value="active">Активен</option>
                          <option value="inactive">Отключён</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-2 min-w-40">
                          <div className="flex items-center gap-2">
                            <button onClick={saveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded">Сохранить</button>
                            <button onClick={() => { setEditingId(null); setEditData(null); }} className="text-gray-600 hover:bg-gray-100 p-1 rounded">Отмена</button>
                          </div>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-sm">{user.username}</td>
                      <td className="px-4 py-3">{user.fullName}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{getRoleName(user.role)}</span></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.isActive ? 'Активен' : 'Отключён'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(user)} title="Редактировать пользователя" aria-label="Редактировать пользователя" className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16} /></button>
                          <button onClick={() => { setPasswordUser(user); setNewPassword(''); setConfirmPassword(''); }} title="Изменить пароль" aria-label="Изменить пароль" className="text-amber-600 hover:bg-amber-50 p-1.5 rounded"><KeyRound size={16} /></button>
                          {deleteConfirm === user.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(user.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Да</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-xs border border-gray-200 px-2 py-1 rounded">Нет</button>
                            </div>
                          ) : (
                            user.id !== currentUser?.id && (
                              <button onClick={() => setDeleteConfirm(user.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                            )
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) { setEditingId(null); setEditData(null); } }}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 id="edit-user-title" className="mb-5 text-lg font-semibold text-gray-900">Редактирование пользователя</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Логин *</label><input value={editData.username} onChange={e => setEditData({...editData, username:e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">ФИО *</label><input value={editData.fullName} onChange={e => setEditData({...editData, fullName:e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Роль</label><select value={editData.roleId} onChange={e => setEditData({...editData, roleId:e.target.value})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Статус</label><select value={editData.isActive?'active':'inactive'} onChange={e=>setEditData({...editData,isActive:e.target.value==='active'})} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="active">Активен</option><option value="inactive">Отключён</option></select></div>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button onClick={()=>{setEditingId(null);setEditData(null)}} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Отмена</button><button onClick={saveEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Сохранить</button></div>
          </div>
        </div>
      )}
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget && !savingPassword) setPasswordUser(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="change-user-password-title" className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h2 id="change-user-password-title" className="mb-1 text-lg font-semibold text-gray-900">Изменение пароля</h2>
            <p className="mb-5 text-sm text-gray-500">Пользователь: <span className="font-medium text-gray-700">{passwordUser.username}</span></p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Новый пароль *</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" autoFocus />
                <p className="mt-1 text-xs text-gray-500">От 12 до 128 символов</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Повторите пароль *</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setPasswordUser(null)} disabled={savingPassword} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">Отмена</button>
              <button onClick={handlePasswordChange} disabled={savingPassword || !newPassword || !confirmPassword} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{savingPassword ? 'Сохранение…' : 'Изменить пароль'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
