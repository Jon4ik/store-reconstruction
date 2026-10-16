import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Save, Server, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';
import SettingsNotice from '../components/SettingsNotice';

type LdapForm = { url: string; baseDN: string; bindDN: string; bindPassword: string; clearBindPassword: boolean };

export default function SettingsPage({ mode = 'ldap' }: { mode?: 'ldap' | 'integrations' }) {
  const { hasPermission } = useStore();
  const [form, setForm] = useState<LdapForm>({ url: '', baseDN: '', bindDN: '', bindPassword: '', clearBindPassword: false });
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [encryptionConfigured, setEncryptionConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [integration, setIntegration] = useState({ enabled: false, apiGateway: '', apiKey: '', clearApiKey: false, apiKeyConfigured: false });
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState('');
  const [message, setMessage] = useState('');
  const noticeMessage = mode === 'integrations' ? integrationMessage : message;
  const noticeVariant: 'success' | 'error' = /ошиб|не удалось|не пройдена/i.test(noticeMessage) ? 'error' : 'success';

  useEffect(() => {
    if (mode !== 'ldap' || (!hasPermission('manage_ldap') && !hasPermission('settings'))) { setLoading(false); return; }
    apiClient.getLdapSettings().then(settings => {
      setForm(current => ({ ...current, url: settings.url || '', baseDN: settings.baseDN || '', bindDN: settings.bindDN || '' }));
      setPasswordConfigured(Boolean(settings.passwordConfigured));
      setEncryptionConfigured(Boolean(settings.encryptionConfigured));
    }).catch(error => setMessage('Не удалось загрузить настройки: ' + (error as Error).message))
      .finally(() => setLoading(false));
  }, [mode, hasPermission]);

  useEffect(() => { if (mode === 'integrations' && (hasPermission('manage_integrations') || hasPermission('settings'))) apiClient.getIntraDeskSettings().then(data => setIntegration(current => ({...current, enabled: data.enabled, apiGateway: data.apiGateway, apiKeyConfigured: data.apiKeyConfigured}))).catch(error => setIntegrationMessage('Не удалось загрузить настройки интеграции: ' + (error as Error).message)); }, [mode, hasPermission]);

  if (!hasPermission('manage_ldap') && !hasPermission('manage_integrations') && !hasPermission('settings')) {
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
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{mode === 'integrations' ? 'Интеграции' : 'Настройки LDAP / Active Directory'}</h1>
        <p className="text-sm text-gray-500 mt-1">{mode === 'integrations' ? 'Параметры внешних сервисов и рекомендации по безопасному подключению.' : 'Параметры подключения используются для синхронизации справочников из AD.'}</p>
      </div>

      {noticeMessage && <SettingsNotice message={noticeMessage} variant={noticeVariant} onDismiss={() => mode === 'integrations' ? setIntegrationMessage('') : setMessage('')} />}

      <div className={mode === 'ldap' || mode === 'integrations' ? 'grid w-full grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start' : 'contents'}>
      {mode === 'ldap' && (hasPermission('manage_ldap') || hasPermission('settings')) && <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Server size={22} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Подключение к каталогу</h2>
        </div>
        {loading ? <p className="text-sm text-gray-500">Загрузка настроек...</p> : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL LDAP *</label>
              <input value={form.url} onChange={e => update('url', e.target.value)} placeholder="ldaps://ad.company.local:636" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <p className="text-xs text-gray-500 mt-1">Укажите имя DNS или адрес контроллера домена. Для production рекомендуется LDAPS (обычно порт 636) и проверка сертификата.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base DN *</label>
              <input value={form.baseDN} onChange={e => update('baseDN', e.target.value)} placeholder="DC=company,DC=local" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <p className="mt-1 text-xs text-gray-500">Корневой Distinguished Name каталога, в котором выполняется поиск пользователей и групп. Например: DC=company,DC=local.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bind DN / логин сервисной учётной записи *</label>
              <input value={form.bindDN} onChange={e => update('bindDN', e.target.value)} placeholder="CN=svc-ldap,OU=Service Accounts,DC=company,DC=local" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <p className="mt-1 text-xs text-gray-500">Укажите полный DN сервисной учётной записи с правами чтения нужных атрибутов. Не используйте личную учётную запись администратора.</p>
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
                <CheckCircle2 size={16} /> {testing ? 'Проверка...' : 'Проверить подключение'}
              </button>
            </div>
          </>
        )}
      </section>}

      {mode === 'integrations' && (hasPermission('manage_integrations') || hasPermission('settings')) && <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div><h2 className="text-lg font-semibold text-gray-900">Интеграция с IntraDesk</h2><p className="text-sm text-gray-500 mt-1">Настройте шлюз и секретный ключ для внешней интеграции.</p></div>
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"><input type="checkbox" checked={integration.enabled} onChange={e=>setIntegration({...integration,enabled:e.target.checked})} className="h-4 w-4"/><span className="text-sm font-medium text-gray-800">Интеграция включена</span></label>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">API-шлюз</label><input value={integration.apiGateway} onChange={e=>setIntegration({...integration,apiGateway:e.target.value})} placeholder="https://intradeck.company.local/api" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"/></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">API-ключ</label><input type="password" value={integration.apiKey} onChange={e=>setIntegration({...integration,apiKey:e.target.value,clearApiKey:false})} autoComplete="new-password" placeholder={integration.apiKeyConfigured?'Ключ сохранён и скрыт; пустое поле сохранит текущий':'Введите API-ключ'} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"/><p className="mt-1 text-xs text-gray-500">Ключ шифруется AES-256-GCM перед записью в PostgreSQL.</p>{integration.apiKeyConfigured && <label className="mt-2 flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={integration.clearApiKey} onChange={e=>setIntegration({...integration,clearApiKey:e.target.checked,apiKey:''})}/> Удалить сохранённый ключ</label>}</div>
        <div className="flex items-center gap-3"><button disabled={integrationSaving} onClick={async()=>{setIntegrationSaving(true);setIntegrationMessage('');try{const result=await apiClient.saveIntraDeskSettings({enabled:integration.enabled,apiGateway:integration.apiGateway, ...(integration.apiKey?{apiKey:integration.apiKey}:{}), ...(integration.clearApiKey?{clearApiKey:true}:{})});setIntegration(current=>({...current,apiKey:'',clearApiKey:false,apiKeyConfigured:result.apiKeyConfigured}));setIntegrationMessage('Настройки IntraDesk сохранены.');}catch(e){setIntegrationMessage('Ошибка сохранения: '+(e as Error).message);}finally{setIntegrationSaving(false)}}} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{integrationSaving?'Сохранение…':'Сохранить интеграцию'}</button></div>
      </section>}

      {mode === 'integrations' && <aside className="rounded-xl border border-blue-100 bg-blue-50 p-6 space-y-4 dark-readable-panel">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-blue-950 dark-readable-heading"><ShieldCheck size={21}/>Описание настроек</h2>
        <div><h3 className="text-sm font-semibold text-blue-950 dark-readable-heading">Интеграция с IntraDesk</h3><p className="mt-1 text-sm text-blue-900 dark-readable-copy">Включайте интеграцию только после получения URL API-шлюза и ключа от владельца сервиса. Пока интеграция выключена, приложение не должно выполнять обмен с IntraDesk.</p></div>
        <div><h3 className="text-sm font-semibold text-blue-950 dark-readable-copy">API-шлюз</h3><p className="mt-1 text-sm text-blue-900 dark-readable-copy">Укажите базовый HTTPS-адрес API, предоставленный администратором IntraDesk. Проверьте доступность адреса с сервера приложения и не указывайте адрес пользовательского интерфейса вместо API.</p></div>
        <div><h3 className="text-sm font-semibold text-blue-950 dark-readable-copy">API-ключ</h3><p className="mt-1 text-sm text-blue-900 dark-readable-copy">Секретный ключ вводится только для сохранения или замены и не отображается повторно. Он шифруется на сервере перед записью в PostgreSQL. Храните LDAP_ENCRYPTION_KEY в секретах окружения.</p></div>
        <div className="border-t border-blue-200 pt-3 text-xs text-blue-900 dark-readable-copy">Сохранение параметров настраивает соединение, но само по себе не запускает обмен данными. Для полноценного обмена необходим согласованный API-контракт IntraDesk.</div>
      </aside>}

      {mode === 'ldap' && (hasPermission('manage_ldap') || hasPermission('settings')) && <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
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
      </section>}
      </div>

    </div>
  );
}
