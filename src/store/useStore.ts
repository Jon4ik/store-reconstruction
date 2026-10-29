import { hasRight, normalizePermissions, storeRight } from '../utils/permissions';
import { create } from 'zustand';
import { StoreProject, TU, SystemUser, Role, AuditLogEntry, Comment, Notification, FilterState, ProjectStatus, DatabaseConfig } from '../types';
import { calculateProjectStatus, getNearestEvent } from '../utils/statusCalculator';
import { apiClient } from '../api/client';
import { startOfDay } from 'date-fns';

interface AppState {
  projects: StoreProject[];
  tus: TU[];
  users: SystemUser[];
  roles: Role[];
  auditLog: AuditLogEntry[];
  comments: Comment[];
  notifications: Notification[];
  currentUser: SystemUser | null;
  filters: FilterState;
  selectedProjectId: string | null;
  isCardOpen: boolean;
  isAddModalOpen: boolean;
  isEditing: boolean;
  dbConfig: DatabaseConfig;
  dataLoaded: boolean;

  // Auth
  login: (username: string, password: string) => Promise<boolean | 'disabled'>;
  logout: () => Promise<void>;
  restoreSession: () => void;

  // Filters
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;

  // Projects
  loadProjects: () => Promise<void>;
  addProject: (project: Omit<StoreProject, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isDeleted' | 'createdBy' | 'address' | 'city'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<StoreProject>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;

  // UI
  openCard: (id: string) => void;
  closeCard: () => void;
  openAddModal: (defaultWorkType?: 'Закрытие' | 'Реконструкция' | 'Открытие') => void;
  closeAddModal: () => void;
  setEditing: (val: boolean) => void;
  defaultWorkType: 'Закрытие' | 'Реконструкция' | 'Открытие';

  // TUs
  loadTUs: () => Promise<void>;
  addTU: (tu: Omit<TU, 'id'>) => Promise<void>;
  updateTU: (id: string, updates: Partial<TU>) => Promise<void>;
  deleteTU: (id: string) => Promise<boolean>;

  // Users
  loadUsers: () => Promise<void>;
  addUser: (user: Omit<SystemUser, 'id' | 'createdAt'>) => Promise<void>;
  updateUser: (id: string, updates: Partial<SystemUser>) => Promise<void>;
  deleteUser: (id: string) => Promise<boolean>;

  // Roles
  loadRoles: () => Promise<void>;
  addRole: (role: Omit<Role, 'id'>) => Promise<void>;
  updateRole: (id: string, updates: Partial<Role>) => Promise<void>;
  deleteRole: (id: string) => Promise<boolean>;

  // Comments
  loadComments: (storeId: string) => Promise<void>;
  addComment: (comment: Omit<Comment, 'id' | 'createdAt'>) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;

  // Audit
  loadAuditLog: () => Promise<void>;
  clearAuditLog: () => Promise<number>;

  // DB Config
  updateDbConfig: (config: Partial<DatabaseConfig>) => void;

  // Permissions
  hasPermission: (permission: string) => boolean;

  // Getters
  getFilteredProjects: () => StoreProject[];
  getDashboardStats: () => { total: number; closures: number; reconstructions: number; openings: number; inProgress: number; completed: number; cancelled: number; upcoming7days: number; };
  getNotifications: () => Notification[];
  getUpcomingEvents: () => { storeNumber: string; stage: string; date: Date; daysUntil: number; projectId: string }[];
  getProjectComments: (storeId: string) => Comment[];
}

const defaultFilters: FilterState = {
  search: '', month: '', workType: '', status: '', tuId: '', city: '', showUpcoming: false,
};

export const useStore = create<AppState>((set, get) => ({
  projects: [],
  tus: [],
  users: [],
  roles: [],
  auditLog: [],
  comments: [],
  notifications: [],
  currentUser: null,
  filters: { ...defaultFilters },
  selectedProjectId: null,
  isCardOpen: false,
  isAddModalOpen: false,
  isEditing: false,
  defaultWorkType: 'Закрытие' as 'Закрытие' | 'Реконструкция' | 'Открытие',
  dbConfig: { host: 'localhost', port: 5432, database: 'store_reconstruction', username: 'postgres', password: '', ssl: false },
  dataLoaded: false,

  // Auth
  login: async (username: string, password: string) => {
    try {
      const response = await apiClient.login(username, password);
      apiClient.setToken(response.access_token);
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('currentUser', JSON.stringify(response.user));
      set({ currentUser: response.user });
      return true;
    } catch (error: any) {
      console.error('Login failed:', error);
      // Проверяем если учетная запись отключена
      if (error.message && error.message.includes('отключена')) {
        return 'disabled';
      }
      return false;
    }
  },

  logout: async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    apiClient.clearToken();
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    set({ currentUser: null });
  },

  restoreSession: () => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('currentUser');
    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        apiClient.setToken(token);
        set({ currentUser: user });
      } catch (e) {
        console.error('Failed to restore session:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
      }
    }
  },

  // Filters
  setFilters: (filters: Partial<FilterState>) => set(state => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  // Projects
  loadProjects: async () => {
    if (!get().hasPermission('view')) { set({ projects: [], comments: [], isCardOpen: false }); return; }
    try {
      const response = await apiClient.getProjects();
      set({ projects: response.data.filter((project: StoreProject) => get().hasPermission(storeRight(project.workType, 'view'))) });
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  },

  addProject: async (projectData) => {
    try {
      const project = await apiClient.createProject(projectData);
      await get().loadProjects();
      await get().loadAuditLog(); // Обновляем аудит после создания
    } catch (error) {
      console.error('Failed to add project:', error);
      throw error;
    }
  },

  updateProject: async (id: string, updates: Partial<StoreProject>) => {
    try {
      await apiClient.updateProject(id, updates);
      await get().loadProjects();
      await get().loadAuditLog(); // Обновляем аудит после обновления
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  },

  deleteProject: async (id: string) => {
    try {
      await apiClient.deleteProject(id);
      await get().loadProjects();
      await get().loadAuditLog();
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  },

  restoreProject: async (id: string) => {
    try {
      await apiClient.restoreProject(id);
      await get().loadProjects();
      await get().loadAuditLog();
    } catch (error) {
      console.error('Failed to restore project:', error);
      throw error;
    }
  },

  // UI
  openCard: (id: string) => set({ selectedProjectId: id, isCardOpen: true }),
  closeCard: () => set({ selectedProjectId: null, isCardOpen: false, isEditing: false }),
  openAddModal: (defaultWorkType?: 'Закрытие' | 'Реконструкция' | 'Открытие') => set({ isAddModalOpen: true, defaultWorkType: defaultWorkType || 'Закрытие' }),
  closeAddModal: () => set({ isAddModalOpen: false }),
  setEditing: (val: boolean) => set({ isEditing: val }),

  // TUs
  loadTUs: async () => {
    const has = get().hasPermission;
    if (!has('view_tus') && !['create_closures','create_openings','edit_closures','edit_openings'].some(has)) { set({ tus: [] }); return; }
    try {
      const tus = await apiClient.getTUs(!get().hasPermission('view_tus'));
      set({ tus });
    } catch (error) {
      console.error('Failed to load TUs:', error);
    }
  },

  addTU: async (tuData) => {
    try {
      await apiClient.createTU(tuData);
      await get().loadTUs();
    } catch (error) {
      console.error('Failed to add TU:', error);
      throw error;
    }
  },

  updateTU: async (id: string, updates: Partial<TU>) => {
    try {
      await apiClient.updateTU(id, updates);
      await get().loadTUs();
    } catch (error) {
      console.error('Failed to update TU:', error);
      throw error;
    }
  },

  deleteTU: async (id: string) => {
    try {
      const usedInProjects = get().projects.filter(p => p.tuId === id && !p.isDeleted);
      if (usedInProjects.length > 0) return false;
      
      await apiClient.deleteTU(id);
      await get().loadTUs();
      return true;
    } catch (error) {
      console.error('Failed to delete TU:', error);
      return false;
    }
  },

  // Users
  loadUsers: async () => {
    if (!get().hasPermission('view_users')) { set({ users: [] }); return; }
    try {
      const users = await apiClient.getUsers();
      // Нормализуем данные: извлекаем roleId из объекта role
      const normalizedUsers = users.map((user: any) => ({
        ...user,
        role: user.role?.id || user.roleId || '',
        roleName: user.role?.name || user.roleName || '',
      }));
      set({ users: normalizedUsers });
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  },

  addUser: async (userData) => {
    try {
      await apiClient.createUser(userData);
      await get().loadUsers();
    } catch (error) {
      console.error('Failed to add user:', error);
      throw error;
    }
  },

  updateUser: async (id: string, updates: Partial<SystemUser>) => {
    try {
      await apiClient.updateUser(id, updates);
      await get().loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  },

  deleteUser: async (id: string) => {
    try {
      const currentUser = get().currentUser;
      if (id === currentUser?.id) return false;
      if (get().users.length <= 1) return false;
      
      await apiClient.deleteUser(id);
      await get().loadUsers();
      return true;
    } catch (error) {
      console.error('Failed to delete user:', error);
      return false;
    }
  },

  // Roles
  loadRoles: async () => {
    if (!get().hasPermission('view_roles') && !get().hasPermission('manage_users')) { set({ roles: [] }); return; }
    try {
      const roles = await apiClient.getRoles(!get().hasPermission('view_roles'));
      set({ roles: roles.map((role: Role) => ({ ...role, permissions: normalizePermissions(role.permissions) })) });
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  },

  addRole: async (roleData) => {
    try {
      await apiClient.createRole(roleData);
      await Promise.all([get().loadRoles(), get().loadAuditLog()]);
    } catch (error) {
      console.error('Failed to add role:', error);
      throw error;
    }
  },

  updateRole: async (id: string, updates: Partial<Role>) => {
    try {
      await apiClient.updateRole(id, updates);
      await Promise.all([get().loadRoles(), get().loadAuditLog()]);
    } catch (error) {
      console.error('Failed to update role:', error);
      throw error;
    }
  },

  deleteRole: async (id: string) => {
    try {
      const usedByUsers = get().users.filter(u => u.role === id);
      if (usedByUsers.length > 0) return false;

      await apiClient.deleteRole(id);
      await Promise.all([get().loadRoles(), get().loadAuditLog()]);
      return true;
    } catch (error) {
      console.error('Failed to delete role:', error);
      return false;
    }
  },

  // Comments
  loadComments: async (storeId: string) => {
    if (!get().hasPermission('view_comments')) { set({ comments: [] }); return; }
    try {
      const comments = await apiClient.getComments(storeId);
      set({ comments });
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  },

  addComment: async (commentData) => {
    try {
      await apiClient.addComment(commentData.storeId, commentData.text);
      // Перезагружаем комментарии
      await get().loadComments(commentData.storeId);
    } catch (error) {
      console.error('Failed to add comment:', error);
      throw error;
    }
  },

  deleteComment: async (id: string) => {
    try {
      await apiClient.deleteComment(id);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      throw error;
    }
  },

  // Audit
  loadAuditLog: async () => {
    if (!get().hasPermission('view_audit')) { set({ auditLog: [] }); return; }
    try {
      const response = await apiClient.getAuditLogs();
      set({ auditLog: response.data });
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  },

  clearAuditLog: async () => {
    if (!get().hasPermission('clear_audit')) throw new Error('Недостаточно прав для очистки журнала аудита');
    const result = await apiClient.clearAuditLogs();
    await get().loadAuditLog();
    return result.deletedCount;
  },

  // DB Config
  updateDbConfig: (config: Partial<DatabaseConfig>) => {
    set(state => ({ dbConfig: { ...state.dbConfig, ...config } }));
  },

  // Permissions
  hasPermission: (permission: string) => {
    const user = get().currentUser;
    if (!user) return false;
    return hasRight(user.permissions, permission);
  },

  // Getters
  getFilteredProjects: () => {
    const state = get();
    let projects = state.projects.filter(p => !p.isDeleted);
    const { filters } = state;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      projects = projects.filter(p =>
        String(p.storeNumber ?? '').toLowerCase().includes(search) ||
        String(p.address ?? '').toLowerCase().includes(search) ||
        String(p.city ?? '').toLowerCase().includes(search)
      );
    }
    if (filters.workType) projects = projects.filter(p => p.workType === filters.workType);
    if (filters.status) projects = projects.filter(p => calculateProjectStatus(p) === filters.status);
    if (filters.tuId) projects = projects.filter(p => p.tuId === filters.tuId);
    if (filters.city) projects = projects.filter(p => p.city === filters.city);
    if (filters.month) {
      const [month, year] = filters.month.split('-');
      projects = projects.filter(p => {
        const dates = [p.closureDate, p.demolitionDate, p.installationDate, p.techOpenDate];
        return dates.some(d => {
          if (!d) return false;
          const date = new Date(d);
          return (date.getMonth() + 1) === parseInt(month) && date.getFullYear() === parseInt(year);
        });
      });
    }
    if (filters.showUpcoming) {
      projects = projects.filter(p => {
        const event = getNearestEvent(p);
        return event && event.daysUntil <= 7 && event.daysUntil >= 0;
      });
    }

    projects.sort((a, b) => {
      const eventA = getNearestEvent(a);
      const eventB = getNearestEvent(b);
      if (!eventA && !eventB) return 0;
      if (!eventA) return 1;
      if (!eventB) return -1;
      return eventA.date.getTime() - eventB.date.getTime();
    });
    return projects;
  },

  getDashboardStats: () => {
    const projects = get().projects.filter(p => !p.isDeleted);
    return {
      total: projects.length,
      closures: projects.filter(p => p.workType === 'Закрытие').length,
      reconstructions: projects.filter(p => p.workType === 'Реконструкция').length,
      openings: projects.filter(p => p.workType === 'Открытие').length,
      inProgress: projects.filter(p => { const s = calculateProjectStatus(p); return s !== 'Завершено' && s !== 'Запланирован' && s !== 'Отменено'; }).length,
      completed: projects.filter(p => calculateProjectStatus(p) === 'Завершено').length,
      cancelled: projects.filter(p => calculateProjectStatus(p) === 'Отменено').length,
      upcoming7days: projects.filter(p => { const e = getNearestEvent(p); return e && e.daysUntil <= 7 && e.daysUntil >= 0; }).length,
    };
  },

  getNotifications: () => {
    const projects = get().projects.filter(p => !p.isDeleted);
    const notifications: Notification[] = [];
    projects.forEach(p => {
      const event = getNearestEvent(p);
      if (event) {
        if (event.daysUntil === 0) notifications.push({ id: `notif-today-${p.id}`, storeId: p.id, storeNumber: p.storeNumber, message: `Сегодня: ${event.name}`, type: 'warning', date: new Date().toISOString(), read: false });
        else if (event.daysUntil === 1) notifications.push({ id: `notif-1d-${p.id}`, storeId: p.id, storeNumber: p.storeNumber, message: `Завтра: ${event.name}`, type: 'warning', date: new Date().toISOString(), read: false });
        else if (event.daysUntil === 3) notifications.push({ id: `notif-3d-${p.id}`, storeId: p.id, storeNumber: p.storeNumber, message: `Через 3 дня: ${event.name}`, type: 'info', date: new Date().toISOString(), read: false });
        else if (event.daysUntil === 7) notifications.push({ id: `notif-7d-${p.id}`, storeId: p.id, storeNumber: p.storeNumber, message: `Через 7 дней: ${event.name}`, type: 'info', date: new Date().toISOString(), read: false });
      }
    });
    return notifications;
  },

  getUpcomingEvents: () => {
    const projects = get().projects.filter(p => !p.isDeleted);
    const events: { storeNumber: string; stage: string; date: Date; daysUntil: number; projectId: string }[] = [];
    projects.forEach(p => {
      const event = getNearestEvent(p);
      if (event && event.daysUntil <= 7 && event.daysUntil >= 0) {
        events.push({ storeNumber: p.storeNumber, stage: event.name, date: event.date, daysUntil: event.daysUntil, projectId: p.id });
      }
    });
    events.sort((a, b) => a.daysUntil - b.daysUntil);
    return events;
  },

  getProjectComments: (storeId: string) => {
    return get().comments.filter(c => c.storeId === storeId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
}));
