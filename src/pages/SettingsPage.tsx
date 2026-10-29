import TelegramSettings from '../components/TelegramSettings';
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
  const [pachca, setPachca] = useState({enabled:false,apiGateway:'https://api.pachca.com/api/shared/v1',apiKey:'',clearApiKey:false,apiKeyConfigured:false});
  const [smtp, setSmtp] = useState({enabled:false,host:'',port:587,secure:false,user:'',password:'',clearPassword:false,passwordConfigured:false,fromEmail:'',fromName:''});
  const [expandedIntegration, setExpandedIntegration] = useState('');
  const [integrationMessage, setIntegrationMessage] = useState('');
  const [message, setMessage] = useState('');
  const noticeMessage = mode === 'integrations' ? integrationMessage : message;
  const noticeVariant: 'success' | 'error' = /ошиб|не удалось|не пройдена/i.test(noticeMessage) ? 'error' : 'success';

  useEffect(() => {
    if (mode !== 'ldap' || (!hasPermission('manage_ldap'))) { setLoading(false); return; }
    apiClient.getLdapSettings().then(settings => {
      setForm(current => ({ ...current, url: settings.url || '', baseDN: settings.baseDN || '', bindDN: settings.bindDN || '' }));
      setPasswordConfigured(Boolean(settings.passwordConfigured));
      setEncryptionConfigured(Boolean(settings.encryptionConfigured));
    }).catch(error => setMessage('Не удалось загрузить настройки: ' + (error as Error).message))
      .finally(() => setLoading(false));
  }, [mode, hasPermission]);

  useEffect(() => {
    if (mode !== 'integrations' || (!hasPermission('manage_integrations'))) return;
    Promise.all([apiClient.getIntraDeskSettings(), apiClient.getPachcaSettings(), apiClient.getSmtpSettings()]).then(([intra, p, s]) => {
      setIntegration(current => ({...current, enabled: intra.enabled, apiGateway: intra.apiGateway, apiKeyConfigured: intra.apiKeyConfigured}));
      setPachca(current => ({...current,enabled:p.enabled,apiGateway:p.apiGateway,apiKeyConfigured:p.apiKeyConfigured}));
      setSmtp(current => ({...current,enabled:s.enabled,host:s.host,port:s.port,secure:s.secure,user:s.user,passwordConfigured:s.passwordConfigured,fromEmail:s.fromEmail,fromName:s.fromName}));
    }).catch(error => setIntegrationMessage('Не удалось загрузить настройки интеграций: ' + (error as Error).message));
  }, [mode, hasPermission]);

  if (!hasPermission('manage_ldap') && !hasPermission('manage_integrations')) {
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
      {noticeMessage && <SettingsNotice message={noticeMessage} variant={noticeVariant} onDismiss={() => mode === 'integrations' ? setIntegrationMessage('') : setMessage('')} />}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{mode === 'integrations' ? 'Интеграции' : 'Настройки LDAP / Active Directory'}</h1>
        <p className="text-sm text-gray-500 mt-1">{mode === 'integrations' ? 'Параметры внешних сервисов и рекомендации по безопасному подключению.' : 'Параметры подключения используются для синхронизации справочников из AD.'}</p>
      </div>


      <div className={mode === 'ldap' || mode === 'integrations' ? 'grid w-full grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start' : 'contents'}>
      {mode === 'ldap' && (hasPermission('manage_ldap')) && <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
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

      {mode === 'integrations' && (hasPermission('manage_integrations')) && <div className="md:col-span-2 space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <TelegramSettings expanded={expandedIntegration==='telegram'} onToggle={()=>setExpandedIntegration(expandedIntegration==='telegram'?'':'telegram')}/>
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">IntraDesk</h2><p className="text-sm text-gray-500">Создание заявок и получение их идентификаторов</p></div><div className="flex items-center gap-3"><span className={integration.enabled?'text-xs font-medium text-green-700':'text-xs text-gray-500'}>{integration.enabled?'Включена':'Выключена'}</span><button onClick={()=>setExpandedIntegration(expandedIntegration==='intra'?'':'intra')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">{expandedIntegration==='intra'?'Свернуть':'Настроить'}</button></div></div>
            {expandedIntegration==='intra' && <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={integration.enabled} onChange={e=>setIntegration({...integration,enabled:e.target.checked})}/> Интеграция включена</label>
              <label className="text-sm text-gray-700">API-шлюз<input value={integration.apiGateway} onChange={e=>setIntegration({...integration,apiGateway:e.target.value})} placeholder="https://intradeck.company.local/api" className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/></label>
              <label className="text-sm text-gray-700">API-ключ<input type="password" value={integration.apiKey} onChange={e=>setIntegration({...integration,apiKey:e.target.value,clearApiKey:false})} placeholder={integration.apiKeyConfigured?'Ключ сохранён; пустое поле оставит его без изменений':'Введите API-ключ'} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/>{integration.apiKeyConfigured && <span className="text-xs text-gray-500"><input type="checkbox" checked={integration.clearApiKey} onChange={e=>setIntegration({...integration,clearApiKey:e.target.checked,apiKey:''})}/> Удалить ключ</span>}</label>
              <div className="md:col-span-2"><button disabled={integrationSaving} onClick={async()=>{setIntegrationSaving(true);setIntegrationMessage('');try{const result=await apiClient.saveIntraDeskSettings({enabled:integration.enabled,apiGateway:integration.apiGateway,...(integration.apiKey?{apiKey:integration.apiKey}:{}),...(integration.clearApiKey?{clearApiKey:true}:{})});setIntegration(v=>({...v,apiKey:'',clearApiKey:false,apiKeyConfigured:result.apiKeyConfigured}));setIntegrationMessage('Настройки IntraDesk сохранены.');}catch(e){setIntegrationMessage('Ошибка сохранения IntraDesk: '+(e as Error).message);}finally{setIntegrationSaving(false)}}} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{integrationSaving?'Сохранение…':'Сохранить'}</button></div>
            </div>}
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">Интеграция с Pachca</h2><p className="text-sm text-gray-500">Отправка уведомлений в каналы и личные сообщения</p></div><div className="flex items-center gap-3"><span className={pachca.enabled?'text-xs font-medium text-green-700':'text-xs text-gray-500'}>{pachca.enabled?'Включена':'Выключена'}</span><button onClick={()=>setExpandedIntegration(expandedIntegration==='pachca'?'':'pachca')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">{expandedIntegration==='pachca'?'Свернуть':'Настроить'}</button></div></div>
            {expandedIntegration==='pachca' && <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={pachca.enabled} onChange={e=>setPachca({...pachca,enabled:e.target.checked})}/> Интеграция включена</label>
              <label className="text-sm text-gray-700">API-шлюз<input value={pachca.apiGateway} onChange={e=>setPachca({...pachca,apiGateway:e.target.value})} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/></label>
              <label className="text-sm text-gray-700">API KEY<input type="password" value={pachca.apiKey} onChange={e=>setPachca({...pachca,apiKey:e.target.value,clearApiKey:false})} placeholder={pachca.apiKeyConfigured?'Ключ сохранён; пустое поле оставит его без изменений':'Введите API KEY'} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/>{pachca.apiKeyConfigured && <span className="text-xs text-gray-500"><input type="checkbox" checked={pachca.clearApiKey} onChange={e=>setPachca({...pachca,clearApiKey:e.target.checked,apiKey:''})}/> Удалить ключ</span>}</label>
              <div className="md:col-span-2"><button disabled={integrationSaving} onClick={async()=>{setIntegrationSaving(true);setIntegrationMessage('');try{const result=await apiClient.savePachcaSettings({enabled:pachca.enabled,apiGateway:pachca.apiGateway,...(pachca.apiKey?{apiKey:pachca.apiKey}:{}),...(pachca.clearApiKey?{clearApiKey:true}:{})});setPachca(v=>({...v,apiKey:'',clearApiKey:false,apiKeyConfigured:result.apiKeyConfigured}));setIntegrationMessage('Настройки Pachca сохранены.');}catch(e){setIntegrationMessage('Ошибка сохранения Pachca: '+(e as Error).message);}finally{setIntegrationSaving(false)}}} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Сохранить</button></div>
            </div>}
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">SMTP</h2><p className="text-sm text-gray-500">Отправка уведомлений электронной почтой</p></div><div className="flex items-center gap-3"><span className={smtp.enabled?'text-xs font-medium text-green-700':'text-xs text-gray-500'}>{smtp.enabled?'Включена':'Выключена'}</span><button onClick={()=>setExpandedIntegration(expandedIntegration==='smtp'?'':'smtp')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">{expandedIntegration==='smtp'?'Свернуть':'Настроить'}</button></div></div>
            {expandedIntegration==='smtp' && <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={smtp.enabled} onChange={e=>setSmtp({...smtp,enabled:e.target.checked})}/> Интеграция включена</label>
              <label className="text-sm text-gray-700">SMTP-сервер<input value={smtp.host} onChange={e=>setSmtp({...smtp,host:e.target.value})} placeholder="smtp.company.local" className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/></label>
              <label className="text-sm text-gray-700">Порт<input type="number" min={1} max={65535} value={smtp.port} onChange={e=>setSmtp({...smtp,port:Number(e.target.value)})} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smtp.secure} onChange={e=>setSmtp({...smtp,secure:e.target.checked})}/> SSL/TLS (обычно порт 465)</label>
              <label className="text-sm text-gray-700">Пользователь SMTP<input value={smtp.user} onChange={e=>setSmtp({...smtp,user:e.target.value})} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/></label>
              <label className="text-sm text-gray-700">Пароль SMTP<input type="password" value={smtp.password} onChange={e=>setSmtp({...smtp,password:e.target.value,clearPassword:false})} placeholder={smtp.passwordConfigured?'Пароль сохранён; пустое поле оставит его без изменений':'Пароль SMTP'} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/>{smtp.passwordConfigured && <span className="text-xs text-gray-500"><input type="checkbox" checked={smtp.clearPassword} onChange={e=>setSmtp({...smtp,clearPassword:e.target.checked,password:''})}/> Удалить пароль</span>}</label>
              <label className="text-sm text-gray-700">Email отправителя<input type="email" value={smtp.fromEmail} onChange={e=>setSmtp({...smtp,fromEmail:e.target.value})} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/></label>
              <label className="text-sm text-gray-700">Имя отправителя<input value={smtp.fromName} onChange={e=>setSmtp({...smtp,fromName:e.target.value})} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2"/></label>
              <div className="md:col-span-2"><button disabled={integrationSaving} onClick={async()=>{setIntegrationSaving(true);setIntegrationMessage('');try{const result=await apiClient.saveSmtpSettings({enabled:smtp.enabled,host:smtp.host,port:smtp.port,secure:smtp.secure,user:smtp.user,fromEmail:smtp.fromEmail,fromName:smtp.fromName,...(smtp.password?{password:smtp.password}:{}),...(smtp.clearPassword?{clearPassword:true}:{})});setSmtp(v=>({...v,password:'',clearPassword:false,passwordConfigured:result.passwordConfigured}));setIntegrationMessage('Настройки SMTP сохранены.');}catch(e){setIntegrationMessage('Ошибка сохранения SMTP: '+(e as Error).message);}finally{setIntegrationSaving(false)}}} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Сохранить</button></div>
            </div>}
          </section>
        </div>
      </div>}

      {mode === 'ldap' && (hasPermission('manage_ldap')) && <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
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
