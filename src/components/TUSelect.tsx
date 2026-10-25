import React, { useId, useState } from 'react';
type DirectoryTU = { id: string; fullName: string; isActive: boolean };
export default function TUSelect({ value, tus, onChange }: { value: string; tus: DirectoryTU[]; onChange: (id: string) => void }) {
  const listId = useId();
  const [tuSearch, setTuSearch] = useState('');
  const [tuSearchOpen, setTuSearchOpen] = useState(false);
  const [tuActiveIndex, setTuActiveIndex] = useState(0);
  const activeTus = tus.filter(t => t.isActive);
  const matchingTus = activeTus.filter(t => t.fullName.toLocaleLowerCase('ru').includes(tuSearch.trim().toLocaleLowerCase('ru')));

  return <>
            <div onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTuSearchOpen(false); }}>
              <input
                role="combobox" aria-label="ТУ" aria-expanded={tuSearchOpen} aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={tuSearchOpen && matchingTus[tuActiveIndex] ? `${listId}-option-${matchingTus[tuActiveIndex].id}` : undefined}
                value={tuSearchOpen ? tuSearch : activeTus.find(t => t.id === value)?.fullName || ''}
                placeholder="Не выбран"
                onFocus={() => { setTuSearch(''); setTuActiveIndex(0); setTuSearchOpen(true); }}
                onChange={e => { setTuSearch(e.target.value); onChange(''); setTuActiveIndex(0); setTuSearchOpen(true); }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { e.stopPropagation(); setTuSearchOpen(false); }
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault(); setTuSearchOpen(true);
                    setTuActiveIndex(i => Math.max(0, Math.min(matchingTus.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
                  }
                  if (e.key === 'Enter' && tuSearchOpen) {
                    e.preventDefault(); const selected = matchingTus[tuActiveIndex];
                    if (selected) { onChange(selected.id); setTuSearchOpen(false); }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {tuSearchOpen && <div id={listId} role="listbox" aria-label="Справочник ТУ" className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(''); setTuSearch(''); setTuSearchOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100">Не выбран</button>
                {matchingTus.map((tu, index) => <button type="button" role="option" id={`${listId}-option-${tu.id}`} key={tu.id} aria-selected={value === tu.id} onMouseEnter={() => setTuActiveIndex(index)} onClick={() => { onChange(tu.id); setTuSearchOpen(false); }} className={`w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 ${index === tuActiveIndex ? 'bg-gray-100' : ''}`}>{tu.fullName}</button>)}
                {matchingTus.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">ТУ не найдены</p>}
              </div>}
            </div>
            <p className="text-xs text-gray-500 mt-1">Начните вводить ФИО для поиска по справочнику ТУ.</p>
  </>;
}
