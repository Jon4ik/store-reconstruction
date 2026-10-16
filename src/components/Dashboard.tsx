import React from 'react';
import { useStore } from '../store/useStore';
import { calculateProjectStatus, getNearestEvent, formatDate } from '../utils/statusCalculator';
import { CheckCircle2, Clock, Package, Store, Wrench, Ban, DoorOpen } from 'lucide-react';

export default function Dashboard() {
  const { getDashboardStats, getUpcomingEvents, projects, openCard, tus } = useStore();
  const stats = getDashboardStats();
  const upcomingEvents = getUpcomingEvents();

  const getTUName = (id: string) => tus.find(t => t.id === id)?.fullName || '—';

  const statCards = [
    { label: 'Всего объектов', value: stats.total, icon: Store, color: 'bg-blue-50 text-blue-700' },
    { label: 'Закрытий', value: stats.closures, icon: Package, color: 'bg-orange-50 text-orange-700' },
    { label: 'Реконструкций', value: stats.reconstructions, icon: Wrench, color: 'bg-purple-50 text-purple-700' },
    { label: 'Открытий', value: stats.openings, icon: DoorOpen, color: 'bg-green-50 text-green-700' },
    { label: 'Завершено', value: stats.completed, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Отменено', value: stats.cancelled, icon: Ban, color: 'bg-gray-100 text-gray-700' },
  ];

  const groupedEvents: { [key: string]: typeof upcomingEvents } = {};
  upcomingEvents.forEach(event => {
    let label: string;
    if (event.daysUntil === 0) label = 'Сегодня';
    else if (event.daysUntil === 1) label = 'Завтра';
    else label = formatDate(event.date);
    if (!groupedEvents[label]) groupedEvents[label] = [];
    groupedEvents[label].push(event);
  });

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center mb-3`}><card.icon size={18} /></div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Events - компактный блок */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Clock size={18} className="text-blue-600" />Ближайшие события</h3>
        </div>
        <div className="p-4">
          {Object.keys(groupedEvents).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Нет предстоящих событий</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(groupedEvents).map(([label, events]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${label === 'Сегодня' ? 'text-red-600' : label === 'Завтра' ? 'text-orange-600' : 'text-gray-500'}`}>{label}</p>
                  <div className="space-y-1.5">
                    {events.map((event, idx) => {
                      const project = projects.find(p => p.id === event.projectId);
                      return (
                        <button key={idx} onClick={() => openCard(event.projectId)} className="dashboard-upcoming-event w-full flex items-center justify-between p-2 rounded hover:bg-white text-left transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">№{event.storeNumber}</p>
                            <p className="text-xs text-gray-500 truncate">{event.stage}</p>
                          </div>
                          {project && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ml-2 flex-shrink-0 ${
                              project.workType === 'Закрытие' ? 'bg-orange-100 text-orange-700' :
                              project.workType === 'Открытие' ? 'bg-green-100 text-green-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>{project.workType}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

function getReadableTextColor(color?: string): string | undefined {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  const values = color.slice(1).match(/.{2}/g)!.map(part => parseInt(part, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  return luminance > 0.45 ? '#111827' : '#f9fafb';
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: { [key: string]: string } = {
    'Запланирован': 'bg-blue-100 text-blue-700', 'Закрыт для покупателей': 'bg-yellow-100 text-yellow-700',
    'Демонтаж': 'bg-orange-100 text-orange-700', 'Монтаж': 'bg-purple-100 text-purple-700',
    'Техническое открытие': 'bg-cyan-100 text-cyan-700', 'Завершено': 'bg-green-100 text-green-700',
    'Отменено': 'bg-gray-200 text-gray-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorMap[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
}
