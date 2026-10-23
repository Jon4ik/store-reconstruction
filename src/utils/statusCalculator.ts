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

// Возвращает этапы в зависимости от типа работ
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
  
  const stages: { name: string; date: string | null }[] = stageDefs.map(s => ({
    name: s.name,
    date: (project as any)[s.dateKey] || null,
  }));

  let foundCurrent = false;
  
  return stages.map((stage, index) => {
    const date = parseDate(stage.date);
    let status: StageStatus;
    let isOverdue = false;
    let daysUntil: number | null = null;
    let daysOverdue: number | null = null;
    const stageTasks = project.stageTasks || {};
    const plannedComplete = project.workType === 'Открытие' || (
      stageTasks.sdRequest?.completed === true &&
      stageTasks.sberApplication?.completed === true &&
      stageTasks.lakshmiApplication?.completed === true
    );
    if (stage.name === 'Запланировано') {
      if (plannedComplete) return { name: stage.name, date: null, status: 'completed', isOverdue: false, daysUntil: null, daysOverdue: null };
      foundCurrent = true;
      return { name: stage.name, date: null, status: 'current', isOverdue: false, daysUntil: null, daysOverdue: null };
    }
    if (stage.name === 'Закрыт для покупателей' && stageTasks.buyersClosed?.completed === true) {
      return { name: stage.name, date: stage.date, status: 'completed', isOverdue: false, daysUntil: null, daysOverdue: null };
    }
    if (stage.name === 'Работы завершены') {
      const completed = stageTasks.projectCompleted?.completed === true;
      const previousStagesCompleted = stages.slice(0, index).every((previousStage) => {
        if (previousStage.name === 'Запланировано') return plannedComplete;
        if (previousStage.name === 'Закрыт для покупателей') return stageTasks.buyersClosed?.completed === true || (
          previousStage.date ? (parseDate(previousStage.date) !== null && isBefore(parseDate(previousStage.date)!, today)) : false
        );
        const previousDate = parseDate(previousStage.date);
        return previousDate !== null && isBefore(previousDate, today);
      });
      return {
        name: stage.name,
        date: null,
        status: completed ? 'completed' : previousStagesCompleted ? 'current' : 'planned',
        isOverdue: false,
        daysUntil: null,
        daysOverdue: null,
      };
    }
    if (!plannedComplete) {
      return { name: stage.name, date: stage.date, status: 'planned', isOverdue: false, daysUntil: date ? differenceInDays(date, today) : null, daysOverdue: null };
    }

    if (!date) {
      status = 'not_started';
    } else if (isBefore(date, today)) {
      if (!foundCurrent) {
        status = 'completed';
      } else {
        status = 'not_started';
      }
    } else if (date.getTime() === today.getTime()) {
      if (!foundCurrent) {
        status = 'current';
        foundCurrent = true;
        daysUntil = 0;
      } else {
        status = 'planned';
        daysUntil = differenceInDays(date, today);
      }
    } else {
      if (!foundCurrent) {
        status = 'current';
        foundCurrent = true;
        daysUntil = differenceInDays(date, today);
      } else {
        status = 'planned';
        daysUntil = differenceInDays(date, today);
      }
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

  const allCompleted = stages.length > 0 && stages.every(s => s.status === 'completed');
  if (allCompleted) return 'Завершено';

  const currentStage = stages.find(s => s.status === 'current');
  if (currentStage) {
    switch (currentStage.name) {
      case 'Закрыт для покупателей': return 'Закрыт для покупателей';
      case 'Демонтаж': return 'Демонтаж';
      case 'Монтаж': return 'Монтаж';
      case 'Техническое открытие': return 'Техническое открытие';
    }
  }

  // Для открытия - если монтаж в будущем
  if (project.workType === 'Открытие') {
    if (project.installationDate) {
      const d = parseDate(project.installationDate);
      if (d && isAfter(d, today)) return 'Запланирован';
    }
    return 'Запланирован';
  }

  return 'Запланирован';
}

export function getNearestEvent(project: StoreProject): { name: string; date: Date; daysUntil: number } | null {
  const today = startOfDay(new Date());
  const dates: { name: string; date: Date }[] = [];

  const stageDefs = getStagesByWorkType(project.workType);
  stageDefs.forEach(s => {
    const dateStr = (project as any)[s.dateKey];
    if (dateStr) {
      const d = parseDate(dateStr);
      if (d && !isBefore(d, today)) dates.push({ name: s.name, date: d });
    }
  });

  if (dates.length === 0) return null;
  dates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = dates[0];
  return { name: next.name, date: next.date, daysUntil: differenceInDays(next.date, today) };
}

export function getOverdueInfo(project: StoreProject): { stage: string; days: number } | null {
  const today = startOfDay(new Date());
  const stages = calculateStages(project);
  for (const stage of stages) {
    if (stage.isOverdue && stage.daysOverdue !== null) {
      return { stage: stage.name, days: stage.daysOverdue };
    }
  }
  return null;
}
