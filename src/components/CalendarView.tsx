import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { calculateProjectStatus, parseDate, formatDate, getStagesByWorkType } from '../utils/statusCalculator';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';

type ViewMode = 'month' | 'week' | 'list';

export default function CalendarView() {
  const { projects, openCard } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const activeProjects = projects.filter(p => !p.isDeleted);

  const allEvents = useMemo(() => {
    const events: { id: string; projectId: string; storeNumber: string; stage: string; date: Date; workType: string; status: string; rowColor: string }[] = [];
    activeProjects.forEach(p => {
      const status = calculateProjectStatus(p);
      const stages = getStagesByWorkType(p.workType);
      stages.forEach(s => {
        const dateStr = (p as any)[s.dateKey];
        if (!dateStr) return;
        const d = parseDate(dateStr);
        if (!d) return;
        events.push({ id: `${p.id}-${s.name}`, projectId: p.id, storeNumber: p.storeNumber, stage: s.name, date: d, workType: p.workType, status, rowColor: p.rowColor });
      });
    });
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activeProjects]);

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
    else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const getMonthDays = () => {
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1; if (startDay < 0) startDay = 6;
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    return days;
  };

  const getWeekDays = () => {
    const d = new Date(currentDate); const dayOfWeek = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) { const day = new Date(monday); day.setDate(monday.getDate() + i); days.push({ date: day, isCurrentMonth: true }); }
    return days;
  };

  const getEventsForDate = (date: Date) => allEvents.filter(e => e.date.getDate() === date.getDate() && e.date.getMonth() === date.getMonth() && e.date.getFullYear() === date.getFullYear());
  const today = new Date();
  const isToday = (date: Date) => date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

  const getStageColor = (stage: string, workType: string) => {
    if (workType === 'Открытие') {
      switch (stage) { case 'Монтаж': return 'bg-purple-200 text-purple-800 dark-readable-event'; case 'Техническое открытие': return 'bg-green-200 text-green-800 dark-readable-event'; default: return 'bg-gray-200 text-gray-800 dark-readable-event'; }
    }
    switch (stage) { case 'Закрыт для покупателей': return 'bg-orange-200 text-orange-800 dark-readable-event'; case 'Демонтаж': return 'bg-yellow-200 text-yellow-800 dark-readable-event'; case 'Монтаж': return 'bg-purple-200 text-purple-800 dark-readable-event'; case 'Техническое открытие': return 'bg-green-200 text-green-800 dark-readable-event'; default: return 'bg-gray-200 text-gray-800 dark-readable-event'; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronLeft size={18} /></button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
            {viewMode === 'week' ? `Неделя: ${formatDate(getWeekDays()[0].date)} — ${formatDate(getWeekDays()[6].date)}` : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          </h2>
          <button onClick={() => navigate(1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><ChevronRight size={18} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Сегодня</button>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}>Месяц</button>
          <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}>Неделя</button>
          <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}><List size={16} /></button>
        </div>
      </div>

      {(viewMode === 'month' || viewMode === 'week') && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {dayNames.map(day => <div key={day} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {(viewMode === 'month' ? getMonthDays() : getWeekDays()).map((day, idx) => {
              const events = getEventsForDate(day.date);
              return (
                <div key={idx} className={`min-h-[100px] border-b border-r border-gray-100 p-1 ${isToday(day.date) ? 'bg-blue-50' : ''} ${!day.isCurrentMonth && viewMode === 'month' ? 'text-gray-300' : ''}`}>
                  <div className={`text-xs font-medium mb-1 px-1 ${isToday(day.date) ? 'text-blue-600' : 'text-gray-600'}`}>{day.date.getDate()}</div>
                  <div className="space-y-0.5">
                    {events.slice(0, 3).map(event => (
                      <button key={event.id} onClick={() => openCard(event.projectId)} className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate ${getStageColor(event.stage, event.workType)} hover:opacity-80`} title={`Магазин №${event.storeNumber} — ${event.stage}`}>
                        Магазин №{event.storeNumber} {event.stage}
                      </button>
                    ))}
                    {events.length > 3 && <p className="text-[10px] text-gray-500 px-1">+{events.length - 3} ещё</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="divide-y divide-gray-100">
            {allEvents.filter(e => e.date.getMonth() === currentDate.getMonth() && e.date.getFullYear() === currentDate.getFullYear()).map(event => (
              <button key={event.id} onClick={() => openCard(event.projectId)} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 text-left">
                <div className="w-12 text-center"><p className="text-lg font-bold text-gray-900">{event.date.getDate()}</p><p className="text-xs text-gray-500">{monthNames[event.date.getMonth()].slice(0, 3)}</p></div>
                <div className="flex-1"><p className="text-sm font-medium text-gray-900">Магазин №{event.storeNumber}</p><p className="text-xs text-gray-500">{event.stage}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${event.workType === 'Закрытие' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{event.workType}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${event.status === 'Просрочено' ? 'bg-red-100 text-red-700' : event.status === 'Завершено' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{event.status}</span>
              </button>
            ))}
            {allEvents.filter(e => e.date.getMonth() === currentDate.getMonth() && e.date.getFullYear() === currentDate.getFullYear()).length === 0 && <p className="text-center text-gray-500 py-8 text-sm">Нет событий</p>}
          </div>
        </div>
      )}
    </div>
  );
}
