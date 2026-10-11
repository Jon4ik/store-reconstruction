import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Save, Server, ShieldCheck, TestTube2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';

type LdapForm = { url: string; baseDN: string; bindDN: string; bindPassword: string; clearBindPassword: boolean };

export default function SettingsPage() {
  const { hasPermission } = useStore();
  const [form, setForm] = useState<LdapForm>({ url: '', baseDN: '', bindDN: '', bindPassword: '', clearBindPassword: false });
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiClient.getLdapSettings().then(settings => {
      setForm(current => ({ ...current, url: settings.url || '', baseDN: settings.baseDN || '', bindDN: settings.bindDN || '' }));
      setPasswordConfigured(Boolean(settings.passwordConfigured));
      setEncryptionConfigured(Boolean(settings.encryptionConfigured));
    }).catch(error => setMessage('Не удалось загрузить настройки: ' + (error as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (!hasPermission('settings')) {
    return <div className="text-center py-12 text-gray-500">Нет доступа к этой странице</div>;
  }

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const result = await apiClient.saveLdapSettings({
        url: form.url.trim(),
        baseDN: form.baseDN.trim(),
        bindDN: form.bindDN.trim(),
        ...(form.bindPassword ? { bindPassword: form.bindPassword } : {}),
        ...(form.clearBindPassword ? { clearBindPassword: true } : {}),
      });
      setPasswordConfigured(Boolean(result.passwordConfigured));
      setEncryptionConfigured(Boolean(result.encryptionConfigured));
      setForm(current => ({ ...current, bindPassword: '', clearBindPassword: false }));
      setMessage('Настройки сохранены в PostgreSQL. Пароль хранится в зашифрованном виде.');
    } catch (error) {
      setMessage('Ошибка сохранения: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage('');
    try {
      await apiClient.testLdapConnection({ url: form.url, baseDN: form.baseDN, bindDN: form.bindDN, ...(form.bindPassword ? { bindPassword: form.bindPassword } : {}) });
      setMessage('Подключение к LDAP успешно.');
    } catch (error) {
      setMessage('Проверка подключения не пройдена: ' + (error as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const update = (field: keyof LdapForm, value: string | boolean) => setForm(current => ({ ...current, [field]: value }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки LDAP / Active Directory</h1>
        <p className="text-sm text-gray-500 mt-1">Параметры подключения используются для синхронизации справочника ТУ.</p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Server size={22} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Подключение к каталогу</h2>
        </div>
        {loading ? <p className="text-sm text-gray-500">Загрузка настроек...</p> : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL LDAP *</label>
              <input value={form.url} onChange={e => update('url', e.target.value)} placeholder="ldaps://ad.company.local:636" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">Для production рекомендуется LDAPS (порт 636) с проверкой сертификата.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base DN *</label>
              <input value={form.baseDN} onChange={e => update('baseDN', e.target.value)} placeholder="DC=company,DC=local" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bind DN / логин сервисной учётной записи *</label>
              <input value={form.bindDN} onChange={e => update('bindDN', e.target.value)} placeholder="CN=svc-ldap,OU=Service Accounts,DC=company,DC=local" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль сервисной учётной записи</label>
              <input type="password" value={form.bindPassword} onChange={e => update('bindPassword', e.target.value)} autoComplete="new-password" placeholder={passwordConfigured ? 'Сохранённый пароль не отображается; пустое поле его сохранит' : 'Введите пароль'} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">{passwordConfigured ? 'Пароль уже сохранён. Чтобы заменить его, введите новый.' : 'Пароль ещё не настроен.'}</p>
            </div>
            {passwordConfigured && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.clearBindPassword} onChange={e => update('clearBindPassword', e.target.checked)} />
                Удалить сохранённый пароль
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </button>
              <button onClick={test} disabled={testing || !form.url.trim() || !form.baseDN.trim() || !form.bindDN.trim() || (!passwordConfigured && !form.bindPassword)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                <TestTube2 size={16} /> {testing ? 'Проверка...' : 'Проверить подключение'}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <ShieldCheck size={22} className="text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Защита данных</h2>
        </div>
        <p className="text-sm text-gray-600">Пароль LDAP шифруется алгоритмом AES-256-GCM перед сохранением в PostgreSQL. Ключ шифрования не хранится в базе данных.</p>
        <p className="text-sm text-gray-600">Перед запуском API добавьте в переменные окружения <code className="font-mono">LDAP_ENCRYPTION_KEY</code> — случайный ключ в hex длиной 64 символа. Например, сгенерируйте его командой <code className="font-mono">openssl rand -hex 32</code>. Храните ключ в секретах окружения и не меняйте без повторного ввода пароля LDAP.</p>
        <div className="flex items-center gap-2 text-sm">
          {encryptionConfigured ? <CheckCircle2 size={17} className="text-green-600" /> : <KeyRound size={17} className="text-amber-600" />}
          <span className={encryptionConfigured ? 'text-green-700' : 'text-amber-700'}>{encryptionConfigured ? 'Ключ шифрования настроен' : 'Ключ шифрования не настроен — синхронизация отключена'}</span>
        </div>
      </section>

      {message && <p role="status" className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">{message}</p>}
    </div>
  );
}
