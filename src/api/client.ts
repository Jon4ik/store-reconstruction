const API_BASE_URL = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(username: string, password: string) {
    return this.request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getProfile() {
    return this.request<any>('/auth/me');
  }

  async updateMyProfile(data: { username?: string; fullName?: string; chatId?: string | null; telegramId?: string | null; theme?: 'light' | 'dark' | 'system' }) {
    return this.request<any>('/auth/me/profile', { method: 'POST', body: JSON.stringify(data) });
  }

  async changeMyPassword(currentPassword: string, newPassword: string) {
    return this.request<{ access_token: string; user: any }>('/auth/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Projects
  async getProjects(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any>(`/stores${queryString}`);
  }

  async getProject(id: string) {
    return this.request<any>(`/stores/${id}`);
  }

  async createProject(data: any) {
    return this.request<any>('/stores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: any) {
    return this.request<any>(`/stores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.request<any>(`/stores/${id}`, {
      method: 'DELETE',
    });
  }

  async restoreProject(id: string) {
    return this.request<any>(`/stores/${id}/restore`, { method: 'POST' });
  }

  // Directory of source shops stored in PostgreSQL
  async getShops(params?: { search?: string; limit?: number }) {
    const query = params ? '?' + new URLSearchParams(Object.entries(params).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== '') acc[key] = String(value);
      return acc;
    }, {} as Record<string, string>)).toString() : '';
    return this.request<any>(`/shops${query}`);
  }

  async syncShops() {
    return this.request<any>('/shops/sync', { method: 'POST' });
  }

  async searchShopByNumber(number: string) {
    return this.request<any[]>(`/shops/lookup?number=${encodeURIComponent(number)}`);
  }

  // Notification rules
  async getNotificationRules() { return this.request<any[]>('/notifications'); }
  async createNotificationRule(data: any) { return this.request<any>('/notifications', { method: 'POST', body: JSON.stringify(data) }); }
  async updateNotificationRule(id: string, data: any) { return this.request<any>(`/notifications/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteNotificationRule(id: string) { return this.request<any>(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }); }

  // Scheduler
  async getSchedulerTasks() {
    return this.request<any[]>('/scheduler/tasks');
  }

  async updateSchedulerTask(id: string, data: { enabled?: boolean; cronExpression?: string }) {
    return this.request<any>(`/scheduler/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async runSchedulerTask(id: string) {
    return this.request<any>(`/scheduler/tasks/${encodeURIComponent(id)}/run`, { method: 'POST' });
  }

  // TUs
  async getTUs() {
    return this.request<any[]>('/tus');
  }

  async createTU(data: any) {
    return this.request<any>('/tus', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTU(id: string, data: any) {
    return this.request<any>(`/tus/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTU(id: string) {
    return this.request<any>(`/tus/${id}`, {
      method: 'DELETE',
    });
  }

  // LDAP / Active Directory
  async getLdapSettings() { return this.request<any>('/ldap/settings'); }

  async saveLdapSettings(data: { url: string; baseDN: string; bindDN: string; bindPassword?: string; clearBindPassword?: boolean }) {
    return this.request<any>('/ldap/settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  async testLdapConnection(data?: { url?: string; baseDN?: string; bindDN?: string; bindPassword?: string }) {
    return this.request<any>('/ldap/test', { method: 'POST', body: JSON.stringify(data || {}) });
  }

  async getIntraDeskSettings() { return this.request<any>('/ldap/integrations/intradesk'); }
  async saveIntraDeskSettings(data: { enabled: boolean; apiGateway: string; apiKey?: string; clearApiKey?: boolean }) {
    return this.request<any>('/ldap/integrations/intradesk', { method: 'PUT', body: JSON.stringify(data) });
  }

  async getLdapStatus() {
    return this.request<{ configured: boolean }>('/ldap/status');
  }

  async syncTUsFromAD() {
    return this.request<{ success: boolean; found: number; created: number; updated: number; disabled: number; skipped: number }>('/ldap/sync-tus', { method: 'POST' });
  }

  // Users
  async getUsers() {
    return this.request<any[]>('/users');
  }

  async createUser(data: any) {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: any) {
    return this.request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request<any>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Roles
  async getRoles() {
    return this.request<any[]>('/roles');
  }

  async createRole(data: any) {
    return this.request<any>('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRole(id: string, data: any) {
    return this.request<any>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRole(id: string) {
    return this.request<any>(`/roles/${id}`, {
      method: 'DELETE',
    });
  }

  // Audit
  async getAuditLogs(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any>(`/audit${queryString}`);
  }

  async clearAuditLogs() {
    return this.request<{ deletedCount: number }>('/audit/clear', { method: 'DELETE' });
  }

  // Dashboard
  async getDashboard() {
    return this.request<any>('/stores/dashboard');
  }

  // Import


  // Comments
  async getComments(storeId: string) {
    return this.request<any[]>(`/stores/${storeId}/comments`);
  }

  async addComment(storeId: string, text: string) {
    return this.request<any>(`/stores/${storeId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async deleteComment(commentId: string) {
    return this.request<any>(`/stores/comments/${commentId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
