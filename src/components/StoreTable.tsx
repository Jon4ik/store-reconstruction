import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { calculateProjectStatus, getNearestEvent, parseDate } from '../utils/statusCalculator';
import { Search, Filter, Plus, Download } from 'lucide-react';
import Filters from './Filters';
import { exportToExcel } from '../utils/exportUtils';
import { formatDate, formatDateDisplay } from '../utils/format';

type TabType = 'closures' | 'openings';

export default function StoreTable() {
  const { getFilteredProjects, tus, filters, setFilters, openCard, openAddModal, hasPermission } = useStore();
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('closures');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const allFiltered = getFilteredProjects();
  
  // Фильтрация по вкладкам
  const tabProjects = useMemo(() => {
    if (activeTab === 'closures') {
      return allFiltered.filter(p => p.workType === 'Закрытие' || p.workType === 'Реконструкция');
    } else {
      return allFiltered.filter(p => p.workType === 'Открытие');
    }
  }, [allFiltered, activeTab]);
  
  const sortedProjects = useMemo(() => {
    return [...tabProjects].sort((a, b) => {
      const dateField = activeTab === 'closures' ? 'closureDate' : 'installationDate';
      const dateA = (a as any)[dateField] ? parseDate((a as any)[dateField]) : null;
      const dateB = (b as any)[dateField] ? parseDate((b as any)[dateField]) : null;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return sortDir === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });
  }, [tabProjects, sortDir, activeTab]);

  const getTUName = (id: string) => tus.find(t => t.id === id)?.fullName || '—';
  const getTUPhone = (id: string) => tus.find(t => t.id === id)?.phone || '—';

  const handleExport = () => {
    console.log('Экспорт начат', { activeTab, projectsCount: sortedProjects.length });
    
    if (sortedProjects.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    try {
      const dataToExport = sortedProjects.map(p => {
        if (activeTab === 'closures') {
          return {
            '№ магазина': p.storeNumber,
            'Адрес': p.address,
            'Тип работ': p.workType,
            'Закрытие': formatDate(p.closureDate),
            'Демонтаж': formatDate(p.demolitionDate),
            'Монтаж': formatDate(p.installationDate),
            'Тех. открытие': formatDate(p.techOpenDate),
            'Телефон ТУ': getTUPhone(p.tuId),
            'ТУ': getTUName(p.tuId),
            'Статус': calculateProjectStatus(p),
          };
        } else {
          return {
            '№ магазина': p.storeNumber,
            'Адрес': p.address,
            'Монтаж': formatDate(p.installationDate),
            'Тех. открытие': formatDate(p.techOpenDate),
            'Телефон ТУ': getTUPhone(p.tuId),
            'ТУ': getTUName(p.tuId),
            'Статус': calculateProjectStatus(p),
          };
        }
      });

      console.log('Данные для экспорта:', dataToExport);
      const filename = activeTab === 'closures' ? 'closures_reconstructions' : 'openings';
      exportToExcel(dataToExport, filename);
      console.log('Экспорт завершён');
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('Произошла ошибка при экспорте: ' + (error as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('closures')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'closures'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Закрытия / Реконструкции
        </button>
        <button
          onClick={() => setActiveTab('openings')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'openings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Открытия
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по номеру, адресу, городу..."
            value={filters.search}
            onChange={e => setFilters({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
            showFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} /> Фильтры
        </button>
        <button
          onClick={() => openAddModal(activeTab === 'closures' ? 'Закрытие' : 'Открытие')}
          className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium ${
            activeTab === 'closures' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          <Plus size={16} /> {activeTab === 'closures' ? 'Добавить объект' : 'Добавить открытие'}
        </button>
        {hasPermission('export') && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            title="Экспорт в Excel"
          >
            <Download size={16} />
            <span>Экспорт</span>
          </button>
        )}
        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          {activeTab === 'closures' ? 'Дата закрытия' : 'Дата монтажа'} {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {showFilters && <Filters />}

      <div className="text-sm text-gray-500">Найдено: {sortedProjects.length} объектов</div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">№</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Адрес</th>
                {activeTab === 'closures' && (
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Тип</th>
                )}
                {activeTab === 'closures' ? (
                  <>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Закрытие</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Демонтаж</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Монтаж</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Тех.открытие</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Монтаж</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Тех.открытие</th>
                  </>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">ТУ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Телефон ТУ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Статус</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map(project => {
                const status = calculateProjectStatus(project);
                return (
                  <tr
                    key={project.id}
                    className="border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors"
                    style={{ backgroundColor: project.rowColor || undefined, color: getReadableTextColor(project.rowColor) }}
                    onClick={() => openCard(project.id)}
                  >
                    <td className="px-4 py-3 font-semibold text-blue-700">{project.storeNumber}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[250px]">
                      <div className="truncate" title={project.address}>{project.address}</div>
                    </td>
                    {activeTab === 'closures' && (
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          project.workType === 'Закрытие' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {project.workType}
                        </span>
                      </td>
                    )}
                    {activeTab === 'closures' ? (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDateDisplay(project.closureDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDateDisplay(project.demolitionDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDateDisplay(project.installationDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDateDisplay(project.techOpenDate)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDateDisplay(project.installationDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDateDisplay(project.techOpenDate)}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{getTUName(project.tuId)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{getTUPhone(project.tuId)}</td>
                    <td className="px-4 py-3"><StatusBadge status={status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: { [key: string]: string } = {
    'Запланирован': 'bg-blue-100 text-blue-700',
    'Закрыт для покупателей': 'bg-yellow-100 text-yellow-700',
    'Демонтаж': 'bg-orange-100 text-orange-700',
    'Монтаж': 'bg-purple-100 text-purple-700',
    'Открытие': 'bg-green-100 text-green-700',
    'Техническое открытие': 'bg-cyan-100 text-cyan-700',
    'Завершено': 'bg-green-100 text-green-700',
    'Отменено': 'bg-gray-200 text-gray-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${colorMap[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function getReadableTextColor(color?: string): string | undefined {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  const values = color.slice(1).match(/.{2}/g)!.map(part => parseInt(part, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  return luminance > 0.45 ? '#111827' : '#f9fafb';
}
