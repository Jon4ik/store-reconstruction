import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Edit2, Trash2, UserCheck, UserX, Shield } from 'lucide-react';

export default function UsersPage() {
  const { users, roles, addUser, updateUser, deleteUser, currentUser, hasPermission } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', fullName: '', roleId: roles[0]?.id || '', isActive: true });
  const [editData, setEditData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    setEditData({ username: user.username, fullName: user.fullName, roleId: user.role, isActive: user.isActive, password: '' });
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
        const { password, ...profileData } = editData;
        if (password && password.length < 12) { alert('Новый пароль должен содержать минимум 12 символов'); return; }
        await updateUser(editingId, { ...profileData, role: editData.roleId, ...(password ? { password } : {}) });
        setEditingId(null);
        setEditData(null);
      } catch (error) {
        console.error('Failed to update user:', error);
        alert('Ошибка при обновлении пользователя');
      }
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
              const isEditing = editingId === user.id;
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
                          <input type="password" value={editData.password || ''} onChange={e => setEditData({ ...editData, password: e.target.value })} minLength={12} maxLength={128} autoComplete="new-password" placeholder="Новый пароль (необязательно)" className="px-2 py-1 border border-gray-200 rounded text-xs w-52" />
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
                          <button onClick={() => startEdit(user)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16} /></button>
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
    </div>
  );
}
