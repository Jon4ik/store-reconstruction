import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { calculateProjectStatus, calculateStages, getNearestEvent, getOverdueInfo } from '../utils/statusCalculator';
import { X, Edit3, Check, AlertTriangle, Clock, MapPin, User, Calendar, MessageSquare, History, ChevronDown, ChevronUp, Send, Palette } from 'lucide-react';
import { validateDate } from '../utils/validation';
import { formatDate } from '../utils/format';

export default function StoreCard() {
  const { selectedProjectId, isCardOpen, closeCard, projects, tus, users, auditLog, updateProject, deleteProject, currentUser, isEditing, setEditing, hasPermission, addComment, getProjectComments, loadComments } = useStore();
  const [editData, setEditData] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'main' | 'stages' | 'comments' | 'delete'>('main');

  const project = projects.find(p => p.id === selectedProjectId);
  
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
  
  // Загружаем комментарии при открытии карточки
  useEffect(() => {
    if (selectedProjectId && isCardOpen) {
      loadComments(selectedProjectId);
    }
  }, [selectedProjectId, isCardOpen, loadComments]);
  
  if (!project || !isCardOpen) return null;

  const status = calculateProjectStatus(project);
  const stages = calculateStages(project);
  const nearestEvent = getNearestEvent(project);
  const overdueInfo = getOverdueInfo(project);
  const tu = tus.find(t => t.id === project.tuId);
  const projectAudit = auditLog.filter(l => l.storeId === project.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const projectComments = getProjectComments(project.id);

  const handleStartEdit = () => {
    setEditData({
      closureDate: formatDate(project.closureDate),
      demolitionDate: formatDate(project.demolitionDate),
      installationDate: formatDate(project.installationDate),
      techOpenDate: formatDate(project.techOpenDate),
      tuId: project.tuId, comment: project.comment, manualStatus: project.manualStatus, rowColor: project.rowColor,
    });
    setEditing(true);
  };

  const handleSave = () => {
    if (!editData) return;
    
    // Валидация дат
    const dateFields = [
      { value: editData.closureDate, name: 'Закрытие для покупателей' },
      { value: editData.demolitionDate, name: 'Демонтаж' },
      { value: editData.installationDate, name: 'Монтаж' },
      { value: editData.techOpenDate, name: 'Техническое открытие' },
    ];
    
    for (const field of dateFields) {
      if (field.value && !validateDate(field.value)) {
        alert(`Некорректная дата "${field.name}": ${field.value}. Формат: ДД.ММ.ГГГГ`);
        return;
      }
    }
    
    updateProject(project.id, {
      closureDate: editData.closureDate || null, demolitionDate: editData.demolitionDate || null,
      installationDate: editData.installationDate || null, techOpenDate: editData.techOpenDate || null,
      tuId: editData.tuId, comment: editData.comment, manualStatus: editData.manualStatus, rowColor: editData.rowColor,
    });
    setEditing(false); setEditData(null);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    try {
      await addComment({ storeId: project.id, userId: currentUser.id, userName: currentUser.fullName, text: newComment.trim() });
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Ошибка при добавлении комментария');
    }
  };

  const rowColors = ['', '#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3', '#e0e7ff', '#ccfbf1'];

  const getStatusLabel = (s: string) => {
    switch (s) { case 'completed': return 'Выполнен'; case 'current': return 'Текущий'; case 'overdue': return 'Просрочен'; case 'planned': return 'Запланирован'; default: return 'Не начат'; }
  };

  const mainStatusColors: { [key: string]: string } = {
    'Запланирован': 'bg-blue-100 text-blue-700 border-blue-200', 'Закрыт для покупателей': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Демонтаж': 'bg-orange-100 text-orange-700 border-orange-200', 'Монтаж': 'bg-purple-100 text-purple-700 border-purple-200',
    'Техническое открытие': 'bg-cyan-100 text-cyan-700 border-cyan-200', 'Завершено': 'bg-green-100 text-green-700 border-green-200',
    'Отменено': 'bg-gray-200 text-gray-700 border-gray-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40" onClick={closeCard} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Магазин №{project.storeNumber}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{project.workType}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && hasPermission('edit') && (
              <button onClick={handleStartEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                <Edit3 size={14} /> Редактировать
              </button>
            )}
            <button onClick={closeCard} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6 flex-shrink-0">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('main')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'main'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Основное
            </button>
            <button
              onClick={() => setActiveTab('stages')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'stages'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Этапы
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Комментарии и история
            </button>
            {(hasPermission('delete_closures') || hasPermission('delete_openings')) && <button onClick={() => setActiveTab('delete')} className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'delete' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-red-600'}`}>Удаление объекта</button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'delete' && (
            <div className="max-w-2xl mx-auto rounded-xl border border-red-200 bg-red-50 p-6 space-y-4">
              <div className="flex items-start gap-3"><AlertTriangle className="text-red-600 mt-1" size={24}/><div><h3 className="text-lg font-semibold text-red-900">Удаление объекта №{project.storeNumber}</h3><p className="text-sm text-red-800 mt-1">Объект будет скрыт из активных таблиц. Запись и история сохранятся, действие попадёт в аудит.</p></div></div>
              <p className="text-sm text-gray-700">Адрес: <strong>{project.address}</strong></p>
              <button onClick={async () => { if (!window.confirm(`Вы действительно хотите удалить объект №${project.storeNumber}?`)) return; try { await deleteProject(project.id); closeCard(); alert('Объект удалён. Событие записано в аудит.'); } catch (e) { alert('Не удалось удалить объект: ' + (e as Error).message); } }} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Подтвердить удаление</button>
            </div>
          )}

          {/* Tab: Main */}
          {activeTab === 'main' && (
            <div className="space-y-6">
              {/* Status */}
              <div className={`rounded-xl border px-4 py-3 ${mainStatusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide opacity-70">Текущий статус</p>
                    <p className="text-lg font-bold">{status}</p>
                  </div>
                  {overdueInfo && (
                    <div className="flex items-center gap-2 bg-red-200/50 px-3 py-1.5 rounded-lg">
                      <AlertTriangle size={16} className="text-red-700" />
                      <span className="text-sm font-medium text-red-800">Просрочка: {overdueInfo.days} дн.</span>
                    </div>
                  )}
                  {nearestEvent && !overdueInfo && (
                    <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-lg">
                      <Clock size={16} />
                      <span className="text-sm font-medium dark-readable-event">{nearestEvent.daysUntil === 0 ? 'Сегодня' : `Через ${nearestEvent.daysUntil} дн.`}: {nearestEvent.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Адрес</label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{project.address}</p>
                    <p className="mt-1 text-xs text-gray-500">Адрес берётся из справочника магазинов и не редактируется в карточке объекта.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">ТУ (Территориальный управляющий)</label>
                    {isEditing ? (
                      <select value={editData?.tuId || project.tuId} onChange={e => setEditData({ ...editData, tuId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                        {tus.filter(t => t.isActive).map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                      </select>
                    ) : (
                      <div className="bg-gray-50 px-3 py-2 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">{tu?.fullName || '—'}</p>
                        {tu?.phone && <p className="text-xs text-gray-500">{tu.phone}</p>}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Тип работ</label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{project.workType}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Комментарий</label>
                    {isEditing ? (
                      <textarea value={editData?.comment || ''} onChange={e => setEditData({ ...editData, comment: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={3} />
                    ) : (
                      <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg min-h-[60px]">{project.comment || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Цвет строки</label>
                    {isEditing ? (
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                        {rowColors.map(color => (
                          <button key={color || 'none'} onClick={() => setEditData({ ...editData, rowColor: color })}
                            className={`w-7 h-7 rounded border-2 ${editData?.rowColor === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'}`}
                            style={{ backgroundColor: color || '#fff' }} title={color || 'Без цвета'} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                        <div className="w-7 h-7 rounded border border-gray-300" style={{ backgroundColor: project.rowColor || '#fff' }} />
                        <span className="text-xs text-gray-500">{project.rowColor || 'Без цвета'}</span>
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Ручная установка статуса</label>
                      <select value={editData?.manualStatus || ''} onChange={e => setEditData({ ...editData, manualStatus: e.target.value || null })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                        <option value="">Автоматически</option>
                        <option value="Запланирован">Запланирован</option>
                        <option value="Закрыт для покупателей">Закрыт для покупателей</option>
                        <option value="Демонтаж">Демонтаж</option>
                        <option value="Монтаж">Монтаж</option>
                        <option value="Открытие">Открытие</option>
                        <option value="Техническое открытие">Техническое открытие</option>
                        <option value="Завершено">Завершено</option>
                        <option value="Отменено">Отменено</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Stages (Timeline) */}
          {activeTab === 'stages' && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2"><Clock size={18} className="text-blue-600" />Таймлайн этапов</h3>
              <div className="space-y-0">
                {stages.map((stage, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        stage.status === 'completed' ? 'bg-green-500 border-green-500' :
                        stage.status === 'current' ? 'bg-yellow-500 border-yellow-500 animate-pulse' :
                        stage.status === 'overdue' ? 'bg-red-500 border-red-500' :
                        stage.status === 'planned' ? 'bg-blue-500 border-blue-500' :
                        'bg-white border-gray-300'
                      }`} />
                      {idx < stages.length - 1 && (
                        <div className={`w-0.5 h-16 ${stage.status === 'completed' ? 'bg-green-300' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className="flex-1 pb-8">
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-medium ${
                          stage.status === 'current' ? 'text-gray-900' :
                          stage.status === 'overdue' ? 'text-red-700' :
                          'text-gray-600'
                        }`}>
                          {stage.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            stage.status === 'completed' ? 'bg-green-100 text-green-700' :
                            stage.status === 'current' ? 'bg-yellow-100 text-yellow-700' :
                            stage.status === 'overdue' ? 'bg-red-100 text-red-700' :
                            stage.status === 'planned' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {getStatusLabel(stage.status)}
                          </span>
                          {stage.daysOverdue !== null && (
                            <span className="text-xs text-red-600 font-medium">+{stage.daysOverdue} дн.</span>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <input
                          type="date"
                          value={toInputDate(editData?.[getStageField(stage.name)] || '')}
                          onChange={e => setEditData({ ...editData, [getStageField(stage.name)]: fromInputDate(e.target.value) })}
                          className="text-sm border border-gray-200 rounded px-2 py-1 w-40"
                        />
                      ) : (
                        <p className={`text-sm ${stage.date ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                          {formatDate(stage.date) || 'Не назначено'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Comments and History */}
          {activeTab === 'comments' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><MessageSquare size={18} className="text-blue-600" />Комментарии ({projectComments.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto mb-3">
                  {projectComments.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Нет комментариев</p>
                  ) : projectComments.map(c => {
                    const user = users.find(u => u.id === c.userId);
                    return (
                      <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">{user?.fullName || c.userName}</span>
                          <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString('ru-RU')}</span>
                        </div>
                        <p className="text-sm text-gray-700">{c.text}</p>
                      </div>
                    );
                  })}
                </div>
                {hasPermission('add_comments') || hasPermission('edit') ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Добавить комментарий..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
                    <button onClick={handleAddComment} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Send size={16} /></button>
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><History size={18} className="text-gray-600" />История изменений</h3>
                <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-blue-600 hover:text-blue-700 mb-2">
                  {showHistory ? 'Скрыть' : `Показать (${projectAudit.length})`}
                </button>
                {showHistory && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {projectAudit.length === 0 ? <p className="text-sm text-gray-400 italic">Нет записей</p> :
                      projectAudit.map(log => {
                        const user = users.find(u => u.id === log.userId);
                        return (
                          <div key={log.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">{user?.fullName || log.userName}</span>
                              <span className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString('ru-RU')}</span>
                            </div>
                            <p className="text-sm"><span className="font-medium">{log.details}:</span>{' '}
                              <span className="text-red-600 line-through">{log.oldValue}</span>{' → '}<span className="text-green-600">{log.newValue}</span>
                            </p>
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer with Save/Cancel buttons */}
        {isEditing && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
              <Check size={16} />Сохранить
            </button>
            <button onClick={() => { setEditing(false); setEditData(null); }} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getStageField(stageName: string): string {
  switch (stageName) { case 'Закрыт для покупателей': return 'closureDate'; case 'Демонтаж': return 'demolitionDate'; case 'Монтаж': return 'installationDate'; case 'Техническое открытие': return 'techOpenDate'; default: return ''; }
}
