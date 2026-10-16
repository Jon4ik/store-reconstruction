import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';

export default function RolesPage() {
  const { roles, users, addRole, updateRole, deleteRole, hasPermission } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[], isSystem: false });
  const [editData, setEditData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (!hasPermission('manage_roles')) {
    return <div className="text-center py-12 text-gray-500">Нет доступа к этой странице</div>;
  }

  // Модули и их права
  const modules = [
    {
      name: 'Объекты (Закрытия/Реконструкции)',
      key: 'closures',
      permissions: [
        { key: 'view_closures', label: 'Просмотр' },
        { key: 'create_closures', label: 'Создание' },
        { key: 'edit_closures', label: 'Редактирование' },
        { key: 'delete_closures', label: 'Удаление' },
      ]
    },
    {
      name: 'Объекты (Открытия)',
      key: 'openings',
      permissions: [
        { key: 'view_openings', label: 'Просмотр' },
        { key: 'create_openings', label: 'Создание' },
        { key: 'edit_openings', label: 'Редактирование' },
        { key: 'delete_openings', label: 'Удаление' },
      ]
    },
    {
      name: 'Календарь',
      key: 'calendar',
      permissions: [
        { key: 'view_calendar', label: 'Просмотр' },
      ]
    },
    {
      name: 'Dashboard',
      key: 'dashboard',
      permissions: [
        { key: 'view_dashboard', label: 'Просмотр' },
      ]
    },
    {
      name: 'Импорт/Экспорт',
      key: 'import_export',
      permissions: [
        { key: 'import', label: 'Импорт из Excel' },
        { key: 'export', label: 'Экспорт в Excel/CSV' },
      ]
    },
    {
      name: 'Комментарии',
      key: 'comments',
      permissions: [
        { key: 'view_comments', label: 'Просмотр' },
        { key: 'add_comments', label: 'Добавление' },
        { key: 'delete_comments', label: 'Удаление' },
      ]
    },
    {
      name: 'Пользователи',
      key: 'users',
      permissions: [
        { key: 'view_users', label: 'Просмотр' },
        { key: 'manage_users', label: 'Управление (создание, редактирование, удаление)' },
      ]
    },
    {
      name: 'Роли',
      key: 'roles',
      permissions: [
        { key: 'view_roles', label: 'Просмотр' },
        { key: 'manage_roles', label: 'Управление (создание, редактирование, удаление)' },
      ]
    },
    {
      name: 'Справочник ТУ',
      key: 'tus',
      permissions: [
        { key: 'view_tus', label: 'Просмотр' },
        { key: 'manage_tus', label: 'Управление (создание, редактирование, удаление)' },
      ]
    },
    {
      name: 'Аудит',
      key: 'audit',
      permissions: [
        { key: 'view_audit', label: 'Просмотр журнала' },
      ]
    },
    {
      name: 'Настройки',
      key: 'settings',
      permissions: [
        { key: 'settings', label: 'Доступ к настройкам системы' },
      ]
    },
  ];

  const allPermissions = modules.flatMap(m => m.permissions.map(p => p.key));
  const permLabels: Record<string, string> = {};
  modules.forEach(m => m.permissions.forEach(p => { permLabels[p.key] = p.label; }));

  const handleAdd = () => {
    if (!newRole.name.trim()) {
      alert('Укажите название роли');
      return;
    }
    if (roles.find(r => r.name === newRole.name.trim())) {
      alert(`Роль "${newRole.name}" уже существует`);
      return;
    }
    if (newRole.permissions.length === 0) {
      alert('Выберите хотя бы одно разрешение');
      return;
    }
    addRole(newRole);
    setNewRole({ name: '', description: '', permissions: [], isSystem: false });
    setShowAddForm(false);
  };

  const startEdit = (role: any) => {
    setEditingId(role.id);
    setEditData({ name: role.name, description: role.description, permissions: [...role.permissions] });
  };

  const saveEdit = () => {
    if (editingId && editData) {
      if (!editData.name.trim()) {
        alert('Укажите название роли');
        return;
      }
      // Проверяем уникальность имени (исключая текущую роль)
      if (roles.find(r => r.name === editData.name.trim() && r.id !== editingId)) {
        alert(`Роль "${editData.name}" уже существует`);
        return;
      }
      if (editData.permissions.length === 0) {
        alert('Выберите хотя бы одно разрешение');
        return;
      }
      updateRole(editingId, editData);
      setEditingId(null);
      setEditData(null);
    }
  };

  const handleDelete = (id: string) => {
    const success = deleteRole(id);
    if (!success) alert('Нельзя удалить роль, которая используется пользователями');
    setDeleteConfirm(null);
  };

  const togglePermission = (perm: string, target: 'new' | 'edit') => {
    if (target === 'new') {
      setNewRole(prev => ({ ...prev, permissions: prev.permissions.includes(perm) ? prev.permissions.filter(p => p !== perm) : [...prev.permissions, perm] }));
    } else if (editData) {
      setEditData({ ...editData, permissions: editData.permissions.includes(perm) ? editData.permissions.filter((p: string) => p !== perm) : [...editData.permissions, perm] });
    }
  };

  const toggleModulePermissions = (modulePerms: string[], target: 'new' | 'edit') => {
    if (target === 'new') {
      const allSelected = modulePerms.every(p => newRole.permissions.includes(p));
      if (allSelected) {
        setNewRole(prev => ({ ...prev, permissions: prev.permissions.filter(p => !modulePerms.includes(p)) }));
      } else {
        setNewRole(prev => ({ ...prev, permissions: [...new Set([...prev.permissions, ...modulePerms])] }));
      }
    } else if (editData) {
      const allSelected = modulePerms.every(p => editData.permissions.includes(p));
      if (allSelected) {
        setEditData({ ...editData, permissions: editData.permissions.filter((p: string) => !modulePerms.includes(p)) });
      } else {
        setEditData({ ...editData, permissions: [...new Set([...editData.permissions, ...modulePerms])] });
      }
    }
  };

  const getUserCount = (roleId: string) => users.filter(u => u.role === roleId).length;

  const renderPermissionsForm = (target: 'new' | 'edit') => (
    <div className="space-y-3">
      {modules.map(module => {
        const modulePermKeys = module.permissions.map(p => p.key);
        const currentPerms = target === 'new' ? newRole.permissions : (editData?.permissions || []);
        const allSelected = modulePermKeys.every(p => currentPerms.includes(p));
        const someSelected = modulePermKeys.some(p => currentPerms.includes(p));
        
        return (
          <div key={module.key} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={() => toggleModulePermissions(modulePermKeys, target)} className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm font-medium text-gray-900">{module.name}</span>
                {someSelected && !allSelected && <span className="text-xs text-gray-400">(частично)</span>}
              </label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 ml-6">
              {module.permissions.map(perm => (
                <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-gray-50">
                  <input type="checkbox" checked={currentPerms.includes(perm.key)} onChange={() => togglePermission(perm.key, target)} className="w-3.5 h-3.5 text-blue-600 rounded" />
                  <span className="text-xs text-gray-700">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Роли и права доступа</h1>
          <p className="text-sm text-gray-500 mt-1">Настройка прав для каждого модуля системы</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Добавить роль
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Новая роль</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Название *</label>
              <input type="text" value={newRole.name} onChange={e => setNewRole({ ...newRole, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Менеджер" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
              <input type="text" value={newRole.description} onChange={e => setNewRole({ ...newRole, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Разрешения по модулям:</label>
            {renderPermissionsForm('new')}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Создать</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Отмена</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {roles.map(role => {
          const isEditing = editingId === role.id;
          const userCount = getUserCount(role.id);
          return (
            <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Название</label>
                      <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
                      <input type="text" value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Разрешения по модулям:</label>
                    {renderPermissionsForm('edit')}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={saveEdit} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><Check size={14} />Сохранить</button>
                    <button onClick={() => { setEditingId(null); setEditData(null); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Отмена</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{role.name}</h3>
                        {role.isSystem && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Системная</span>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                      <p className="text-xs text-gray-400 mt-1">Пользователей с этой ролью: {userCount}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(role)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16} /></button>
                      {deleteConfirm === role.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(role.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Да</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs border border-gray-200 px-2 py-1 rounded">Нет</button>
                        </div>
                      ) : (
                        !role.isSystem && <button onClick={() => setDeleteConfirm(role.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {modules.map(module => {
                      const modulePerms = role.permissions.filter(p => module.permissions.map(mp => mp.key).includes(p));
                      if (modulePerms.length === 0) return null;
                      return (
                        <div key={module.key}>
                          <p className="text-xs font-medium text-gray-500 mb-1">{module.name}:</p>
                          <div className="flex flex-wrap gap-1">
                            {modulePerms.map(p => <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{permLabels[p] || p}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
