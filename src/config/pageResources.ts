export type PageResource = 'projects' | 'tus' | 'users' | 'roles' | 'audit';
export function getPageResources(page: string, adding = false, editing = false): PageResource[] {
  const resources: Record<string, PageResource[]> = {
    dashboard: ['projects', 'tus'], table: ['projects', 'tus'], calendar: ['projects', 'tus'],
    users: ['users', 'roles'], roles: ['roles', 'users'], tus: ['tus'], audit: ['audit'],
  };
  return [...new Set([...(resources[page] || []), ...(adding || editing ? ['tus' as const] : [])])];
}
