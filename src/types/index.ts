export type WorkType = 'Закрытие' | 'Реконструкция' | 'Открытие';

export type StageStatus = 'completed' | 'current' | 'overdue' | 'planned' | 'not_started';

export type ProjectStatus = 
  | 'Запланирован'
  | 'Закрыт для покупателей'
  | 'Демонтаж'
  | 'Монтаж'
  | 'Открытие'
  | 'Техническое открытие'
  | 'Завершено'
  | 'Отменено'
  | 'Удален';

export interface TU {
  id: string;
  fullName: string;
  position: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface Comment {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface StoreProject {
  id: string;
  storeNumber: string;
  address: string;
  city: string;
  workType: WorkType;
  closureDate: string | null;
  demolitionDate: string | null;
  installationDate: string | null;
  techOpenDate: string | null;
  tuId: string;
  rowColor: string;
  comment: string;
  status: ProjectStatus;
  manualStatus: ProjectStatus | null;
  stageTasks?: Record<string, { completed?: boolean; status?: string; requestNumber?: string; message?: string; updatedAt?: string; completedByUserId?: string; completedByUserName?: string }>;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AuditLogEntry {
  id: string;
  storeId: string | null;
  userId: string | null;
  userName: string;
  timestamp: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  details: string;
}

export interface Notification {
  id: string;
  storeId: string;
  storeNumber: string;
  message: string;
  type: 'warning' | 'danger' | 'info';
  date: string;
  read: boolean;
}

export interface SystemUser {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: string;
  roleName?: string;
  permissions?: string[];
  isActive: boolean;
  createdAt: string;
  theme?: 'light' | 'dark' | 'system';
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

export interface StageInfo {
  name: string;
  date: string | null;
  status: StageStatus;
  isOverdue: boolean;
  daysUntil: number | null;
  daysOverdue: number | null;
}

export interface FilterState {
  search: string;
  month: string;
  workType: WorkType | '';
  status: ProjectStatus | '';
  tuId: string;
  city: string;
  showUpcoming: boolean;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}
