import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';
import { User, Lock, MessageSquare, Palette, Save } from 'lucide-react';
import { SystemUser } from '../types';

export default function ProfilePage() {
  const { currentUser } = useStore();
  const [username, setUsername] = useState(currentUser?.username || '');
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [chatId, setChatId] = useState(currentUser?.chatId || '');
  const [telegramId, setTelegramId] = useState(currentUser?.telegramId || '');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(currentUser?.theme || 'light');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const handleThemeChange = (nextTheme: 'light' | 'dark' | 'system') => {
    setTheme(nextTheme);
    const user = useStore.getState().currentUser;
    if (user) {
      const updatedUser = { ...user, theme: nextTheme };
      useStore.setState({ currentUser: updatedUser });
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  };

  useEffect(() => {
    let active = true;
    apiClient.getProfile().then((profile: any) => {
      if (!active) return;
      setUsername(profile.username || '');
      setFullName(profile.fullName || '');
      setChatId(profile.chatId || '');
      setTelegramId(profile.telegramId || '');
      setTheme(profile.theme || 'light');
      const mergedUser = { ...(useStore.getState().currentUser || {}), ...profile } as SystemUser;
      useStore.setState({ currentUser: mergedUser });
      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
    }).catch(error => {
      console.error('Failed to load profile:', error);
    }).finally(() => {
      if (active) setLoadingProfile(false);
    });
    return () => { active = false; };
  }, []);

  if (!currentUser) {
    return <div className="text-center py-12 text-gray-500">Необходимо войти в систему</div>;
  }

  const handleSaveProfile = async () => {
    const normalizedUsername = username.trim();
    if (normalizedUsername.length < 3) {
      alert('Логин должен содержать минимум 3 символа');
      return;
    }
    setSaving(true);
    try {
      const profile = await apiClient.updateMyProfile({
        username: normalizedUsername,
        fullName,
        chatId: chatId.trim() || null,
        telegramId: telegramId.trim() || null,
        theme,
      });
      const mergedUser = { ...(useStore.getState().currentUser || currentUser), ...profile } as SystemUser;
      useStore.setState({ currentUser: mergedUser });
      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
      alert('Профиль сохранён в базе данных');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Не удалось сохранить профиль: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('Заполните все поля пароля');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Новые пароли не совпадают');
      return;
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      alert('Пароль должен содержать от 12 до 128 символов');
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.changeMyPassword(oldPassword, newPassword);
      apiClient.setToken(response.access_token);
      localStorage.setItem('token', response.access_token);
      const mergedUser = { ...(useStore.getState().currentUser || currentUser), ...response.user } as SystemUser;
      useStore.setState({ currentUser: mergedUser });
      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Пароль изменён в базе данных');
    } catch (error) {
      console.error('Failed to change password:', error);
      alert('Не удалось изменить пароль: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Профиль пользователя</h1>
        <p className="text-sm text-gray-500 mt-1">Настройки профиля сохраняются в базе данных</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <User size={24} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Основная информация</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Логин</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} minLength={3} maxLength={64} autoComplete="username" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ФИО</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} maxLength={120} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Иванов Иван Иванович" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare size={24} className="text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Настройки уведомлений</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ID чата для уведомлений в Пачке</label>
            <input type="text" value={chatId} onChange={e => setChatId(e.target.value)} maxLength={128} placeholder="ID чата" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ID Telegram</label>
            <input type="text" value={telegramId} onChange={e => setTelegramId(e.target.value)} maxLength={128} placeholder="Telegram user ID" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Оба идентификатора сохраняются в профиле пользователя в базе данных.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette size={24} className="text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Тема оформления</h2>
        </div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Выберите тему</label>
        <select value={theme} onChange={e => handleThemeChange(e.target.value as 'light' | 'dark' | 'system')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="light">Светлая тема</option>
          <option value="dark">Тёмная тема</option>
          <option value="system">Системная тема</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Lock size={24} className="text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900">Смена пароля</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Текущий пароль</label>
            <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} autoComplete="current-password" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Новый пароль</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Подтверждение пароля</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <button onClick={handleChangePassword} disabled={saving || loadingProfile} className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-400">
          <Lock size={16} /> Изменить пароль
        </button>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSaveProfile} disabled={saving || loadingProfile} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
          <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
}
