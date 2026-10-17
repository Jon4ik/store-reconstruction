import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { X, AlertCircle, Palette } from 'lucide-react';
import { parseDateInput } from '../utils/statusCalculator';
import { validateDate } from '../utils/validation';
import { apiClient } from '../api/client';

export default function AddStoreModal() {
  const { isAddModalOpen, closeAddModal, addProject, tus, projects, defaultWorkType } = useStore();
  const [form, setForm] = useState({
    storeNumber: '', address: '', city: '', workType: defaultWorkType,
    closureDate: '', demolitionDate: '', installationDate: '', techOpenDate: '',
    tuId: tus[0]?.id || '', comment: '', rowColor: '',
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [shopMatches, setShopMatches] = useState<any[]>([]);
  const [shopSearchLoading, setShopSearchLoading] = useState(false);

  useEffect(() => {
    if (isAddModalOpen) setForm(current => ({ ...current, workType: defaultWorkType }));
  }, [isAddModalOpen, defaultWorkType]);

  // The modal can mount before TUs finish loading. Select an active TU once
  // the list arrives, and never keep an inactive or missing TU selected.
  useEffect(() => {
    if (!isAddModalOpen) return;
    const activeTus = tus.filter(t => t.isActive);
    setForm(current => activeTus.some(t => t.id === current.tuId)
      ? current
      : { ...current, tuId: activeTus[0]?.id || '' });
  }, [tus, isAddModalOpen]);

  useEffect(() => {
    const number = form.storeNumber.trim();
    if (!isAddModalOpen || !number) { setShopMatches([]); setShopSearchLoading(false); setForm(current => ({ ...current, address: '', city: '' })); return; }
    let active = true;
    setShopSearchLoading(true);
    setForm(current => ({ ...current, address: '', city: '' }));
    apiClient.searchShopByNumber(number).then((items: any[]) => {
      if (!active) return;
      setShopMatches(items);
      const normalized = number.padStart(3, '0');
      const match = items.find(item => String(item.shopNumber) === normalized || String(item.shopNumber) === number);
      if (match) setForm(current => ({ ...current, address: match.address || '', city: match.city || '' }));
      else setForm(current => ({ ...current, address: '', city: '' }));
    }).catch(() => { if (active) { setShopMatches([]); setForm(current => ({ ...current, address: '', city: '' })); } })
      .finally(() => { if (active) setShopSearchLoading(false); });
    return () => { active = false; };
  }, [form.storeNumber, isAddModalOpen]);

  if (!isAddModalOpen) return null;

  const rowColors = ['', '#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3'];

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.storeNumber.trim()) {
      errs.push('Укажите номер магазина');
    } else if (!/^\d{1,4}$/.test(form.storeNumber.trim())) {
      errs.push('Номер магазина должен содержать от 1 до 4 цифр');
    }
    if (!form.address.trim()) errs.push('Магазин не найден в справочнике. Проверьте номер и синхронизацию справочника.');
    const activeTus = tus.filter(t => t.isActive);
    if (activeTus.length === 0) {
      errs.push('Нет активных ТУ. Сначала добавьте или активируйте ТУ в справочнике.');
    } else if (!form.tuId || !activeTus.some(t => t.id === form.tuId)) {
      errs.push('Выберите активного ТУ.');
    }

    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    try {
      await addProject({
        storeNumber: form.storeNumber.trim(), workType: form.workType,
        closureDate: form.closureDate ? parseDateInput(form.closureDate) : null,
        demolitionDate: form.demolitionDate ? parseDateInput(form.demolitionDate) : null,
        installationDate: form.installationDate ? parseDateInput(form.installationDate) : null,
        techOpenDate: form.techOpenDate ? parseDateInput(form.techOpenDate) : null,
        tuId: form.tuId, rowColor: form.rowColor, comment: form.comment,
        manualStatus: null,
      });
      setForm({ storeNumber: '', address: '', city: '', workType: 'Закрытие' as 'Закрытие' | 'Реконструкция' | 'Открытие', closureDate: '', demolitionDate: '', installationDate: '', techOpenDate: '', tuId: tus.find(t => t.isActive)?.id || '', comment: '', rowColor: '' });
      closeAddModal();
    } catch (error) {
      console.error('Failed to add project:', error);
      setErrors(['Ошибка при создании объекта: ' + (error as Error).message]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={closeAddModal} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">Добавить объект</h2>
          <button onClick={closeAddModal} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1"><AlertCircle size={16} className="text-red-600" /><span className="text-sm font-medium text-red-800">Ошибки:</span></div>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">{errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Номер магазина <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={form.storeNumber} 
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setForm({ ...form, storeNumber: value });
                }}
                placeholder="864" 
                maxLength={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
              <p className="text-xs text-gray-400 mt-1">Только цифры, максимум 4 знака</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Тип работ <span className="text-red-500">*</span></label>
              <select value={form.workType} onChange={e => setForm({ ...form, workType: e.target.value as any })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Закрытие">Закрытие</option>
                <option value="Реконструкция">Реконструкция</option>
                <option value="Открытие">Открытие</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Адрес магазина <span className="text-red-500">*</span></label>
            <input type="text" value={form.address} readOnly aria-readonly="true" placeholder={shopSearchLoading ? "Поиск магазина…" : "Адрес заполнится по номеру из справочника"} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-700 cursor-not-allowed" />
            <p className="text-xs text-gray-500 mt-1">{shopSearchLoading ? 'Ищем магазин в справочнике…' : form.address ? 'Город: ' + (form.city || 'не указан') : 'Введите номер магазина, чтобы найти адрес в справочнике.'}</p>
            {shopMatches.length > 1 && <div className="mt-2 rounded-lg border border-gray-200 divide-y divide-gray-100">{shopMatches.map((shop, index) => <button type="button" key={String(shop.shopNumber) + '-' + index} onClick={() => setForm(current => ({ ...current, storeNumber: String(shop.shopNumber), address: shop.address || '', city: shop.city || '' }))} className="w-full p-2 text-left text-sm hover:bg-gray-50"><span className="font-medium">№{shop.shopNumber}</span> — {shop.city}, {shop.address}</button>)}</div>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ТУ <span className="text-red-500">*</span></label>
            <select value={form.tuId} onChange={e => setForm({ ...form, tuId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {tus.filter(t => t.isActive).length === 0
                ? <option value="">Нет активных ТУ</option>
                : tus.filter(t => t.isActive).map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
            {tus.filter(t => t.isActive).length === 0 && <p className="text-xs text-red-600 mt-1">Создайте или активируйте ТУ в справочнике, чтобы добавить объект.</p>}
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-3">Даты этапов (формат: ДД.ММ.ГГГГ)</p>
            <div className="grid grid-cols-1 gap-3">
              {form.workType !== 'Открытие' && (
                <>
                  <DateInput label="Закрытие для покупателей" value={form.closureDate} onChange={v => setForm({ ...form, closureDate: v })} />
                  <DateInput label="Демонтаж" value={form.demolitionDate} onChange={v => setForm({ ...form, demolitionDate: v })} />
                </>
              )}
              {form.workType !== 'Закрытие' && (
                <>
                  <DateInput label="Монтаж" value={form.installationDate} onChange={v => setForm({ ...form, installationDate: v })} />
                  <DateInput label="Техническое открытие" value={form.techOpenDate} onChange={v => setForm({ ...form, techOpenDate: v })} />
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Цвет строки</label>
            <div className="flex items-center gap-1">
              {rowColors.map(color => (
                <button key={color || 'none'} onClick={() => setForm({ ...form, rowColor: color })}
                  className={`w-7 h-7 rounded border-2 ${form.rowColor === color ? 'border-blue-500' : 'border-gray-200'}`}
                  style={{ backgroundColor: color || '#fff' }} title={color || 'Без цвета'} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Комментарий</label>
            <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button onClick={handleSubmit} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Добавить объект</button>
            <button onClick={closeAddModal} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // Конвертация из DD.MM.YYYY в YYYY-MM-DD для input type="date"
  const toInputDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    return '';
  };
  
  // Конвертация из YYYY-MM-DD в DD.MM.YYYY
  const fromInputDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}.${month}.${year}`;
    }
    return '';
  };
  
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 w-48 flex-shrink-0">{label}</label>
      <input 
        type="date" 
        value={toInputDate(value)} 
        onChange={e => onChange(fromInputDate(e.target.value))} 
        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
      />
    </div>
  );
}
