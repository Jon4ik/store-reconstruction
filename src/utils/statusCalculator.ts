import { StoreProject, ProjectStatus, StageInfo, StageStatus, WorkType } from '../types';
import { isAfter, isBefore, differenceInDays, startOfDay } from 'date-fns';

export function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date(dateStr);
  } catch {
    return null;
  }
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function parseDateInput(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const d = parseInt(day);
      const m = parseInt(month);
      const y = parseInt(year);
      if (d > 0 && d <= 31 && m > 0 && m <= 12 && y > 2000) {
        return dateStr;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return formatDate(d);
    }
    return null;
  } catch {
    return null;
  }
}

// Возвращает этапы в зависимости от типа работ.
export function getStagesByWorkType(workType: WorkType): { name: string; dateKey: string }[] {
  switch (workType) {
    case 'Закрытие':
      return [
        { name: 'Запланировано', dateKey: '' },
        { name: 'Закрыт для покупателей', dateKey: 'closureDate' },
        { name: 'Демонтаж', dateKey: 'demolitionDate' },
        { name: 'Работы завершены', dateKey: '' },
      ];
    case 'Реконструкция':
      return [
        { name: 'Запланировано', dateKey: '' },
        { name: 'Закрыт для покупателей', dateKey: 'closureDate' },
        { name: 'Демонтаж', dateKey: 'demolitionDate' },
        { name: 'Монтаж', dateKey: 'installationDate' },
        { name: 'Техническое открытие', dateKey: 'techOpenDate' },
        { name: 'Работы завершены', dateKey: '' },
      ];
    case 'Открытие':
      return [
        { name: 'Запланировано', dateKey: '' },
        { name: 'Монтаж', dateKey: 'installationDate' },
        { name: 'Техническое открытие', dateKey: 'techOpenDate' },
        { name: 'Работы завершены', dateKey: '' },
      ];
    default:
      return [];
  }
}

export function calculateStages(project: StoreProject): StageInfo[] {
  const today = startOfDay(new Date());
  const stageDefs = getStagesByWorkType(project.workType);
  const stages = stageDefs.map(s => ({
    name: s.name,
    date: s.dateKey ? (project as any)[s.dateKey] || null : null,
  }));
  const tasks = project.stageTasks || {};
  const plannedComplete = project.workType === 'Открытие' || (
    tasks.sdRequest?.completed === true &&
    tasks.sberApplication?.completed === true &&
    tasks.lakshmiApplication?.completed === true
  );
  const preDemolitionComplete = plannedComplete && tasks.buyersClosed?.completed === true &&
    tasks.ukmShiftsClosed?.completed === true &&
    tasks.ukmOperationalDaysClosed?.completed === true &&
    tasks.cashDelConfigured?.completed === true;
  const demolitionTaskIds = [
    'equipmentDismantled',
    'monitoringRemovalRequested',
    'removedFromMailings',
    'deletedFromPrintstat',
  ];
  const demolitionComplete = demolitionTaskIds.every(taskId => tasks[taskId]?.completed === true);

  let foundCurrent = false;

  return stages.map(stage => {
    const date = parseDate(stage.date);
    let status: StageStatus = 'planned';
    let isOverdue = false;
    let daysUntil: number | null = date ? differenceInDays(date, today) : null;
    let daysOverdue: number | null = null;

    if (stage.name === 'Запланировано') {
      if (plannedComplete) {
        return { name: stage.name, date: null, status: 'completed', isOverdue: false, daysUntil: null, daysOverdue: null };
      }
      foundCurrent = true;
      return { name: stage.name, date: null, status: 'current', isOverdue: false, daysUntil: null, daysOverdue: null };
    }

    if (stage.name === 'Закрыт для покупателей') {
      if (tasks.buyersClosed?.completed === true) {
        return { name: stage.name, date: stage.date, status: 'completed', isOverdue: false, daysUntil: null, daysOverdue: null };
      }
      if (!plannedComplete) {
        return { name: stage.name, date: stage.date, status: 'planned', isOverdue: false, daysUntil, daysOverdue: null };
      }
      if (!date || !isAfter(date, today)) {
        foundCurrent = true;
        return { name: stage.name, date: stage.date, status: 'current', isOverdue: false, daysUntil, daysOverdue: null };
      }
      return { name: stage.name, date: stage.date, status: 'planned', isOverdue: false, daysUntil, daysOverdue: null };
    }

    if (stage.name === 'Демонтаж') {
      if (demolitionComplete) {
        return { name: stage.name, date: stage.date, status: 'completed', isOverdue: false, daysUntil: null, daysOverdue: null };
      }
      if (!preDemolitionComplete) {
        return { name: stage.name, date: stage.date, status: 'planned', isOverdue: false, daysUntil, daysOverdue: null };
      }
      // Демонтаж считается текущим по факту готовности предыдущих задач, а не только по календарной дате.
      foundCurrent = true;
      return { name: stage.name, date: stage.date, status: 'current', isOverdue: false, daysUntil, daysOverdue: null };
    }

    if (stage.name === 'Работы завершены') {
      if (tasks.projectCompleted?.completed === true) {
        return { name: stage.name, date: null, status: 'completed', isOverdue: false, daysUntil: null, daysOverdue: null };
      }
      if (!foundCurrent) {
        foundCurrent = true;
        return { name: stage.name, date: null, status: 'current', isOverdue: false, daysUntil: null, daysOverdue: null };
      }
      return { name: stage.name, date: null, status: 'planned', isOverdue: false, daysUntil: null, daysOverdue: null };
    }

    if (!plannedComplete) {
      return { name: stage.name, date: stage.date, status: 'planned', isOverdue: false, daysUntil, daysOverdue: null };
    }

    if (!date) {
      status = 'not_started';
    } else if (isBefore(date, today)) {
      status = foundCurrent ? 'not_started' : 'completed';
    } else if (date.getTime() === today.getTime()) {
      if (!foundCurrent) {
        status = 'current';
        foundCurrent = true;
        daysUntil = 0;
      } else {
        status = 'planned';
        daysUntil = differenceInDays(date, today);
      }
    } else if (!foundCurrent) {
      status = 'current';
      foundCurrent = true;
      daysUntil = differenceInDays(date, today);
    } else {
      status = 'planned';
      daysUntil = differenceInDays(date, today);
    }

    if (date && isBefore(date, today) && status !== 'completed') {
      isOverdue = true;
      daysOverdue = differenceInDays(today, date);
      status = 'overdue';
    }

    return { name: stage.name, date: stage.date, status, isOverdue, daysUntil, daysOverdue };
  });
}

export function calculateProjectStatus(project: StoreProject): ProjectStatus {
  if (project.isDeleted) return 'Удален';
  if (project.manualStatus) return project.manualStatus;

  const today = startOfDay(new Date());
  const stages = calculateStages(project);
  if (stages.length > 0 && stages.every(stage => stage.status === 'completed')) return 'Завершено';

  const currentStage = stages.find(stage => stage.status === 'current');
  if (currentStage) {
    switch (currentStage.name) {
      case 'Закрыт для покупателей': return 'Закрыт для покупателей';
      case 'Демонтаж': return 'Демонтаж';
      case 'Монтаж': return 'Монтаж';
      case 'Техническое открытие': return 'Техническое открытие';
      case 'Работы завершены': return 'В работе';
    }
  }

  if (project.workType === 'Открытие') {
    if (project.installationDate) {
      const date = parseDate(project.installationDate);
      if (date && isAfter(date, today)) return 'Запланирован';
    }
    return 'Запланирован';
  }

  return 'Запланирован';
}

export function getNearestEvent(project: StoreProject): { name: string; date: Date; daysUntil: number } | null {
  const today = startOfDay(new Date());
  const dates: { name: string; date: Date }[] = [];
  getStagesByWorkType(project.workType).forEach(stage => {
    if (!stage.dateKey) return;
    const dateString = (project as any)[stage.dateKey];
    if (dateString) {
      const date = parseDate(dateString);
      if (date && !isBefore(date, today)) dates.push({ name: stage.name, date });
    }
  });
  if (dates.length === 0) return null;
  dates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = dates[0];
  return { name: next.name, date: next.date, daysUntil: differenceInDays(next.date, today) };
}

export function getOverdueInfo(project: StoreProject): { stage: string; days: number } | null {
  const stages = calculateStages(project);
  for (const stage of stages) {
    if (stage.isOverdue && stage.daysOverdue !== null) {
      return { stage: stage.name, days: stage.daysOverdue };
    }
  }
  return null;
}
