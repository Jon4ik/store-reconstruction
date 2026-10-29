export const videoregsPermissions=['view_videoregs','manage_videoregs','view_videoregs_passwords','import_videoregs'];
export const permissionDependencies: Record<string, string> = {manage_videoregs:'view_videoregs',view_videoregs_passwords:'view_videoregs',import_videoregs:'view_videoregs'};
for (const group of ['closures','openings','users','roles','tus','shops','notifications','comments','audit']) {
  const actions = group === 'audit' ? ['clear'] : group === 'comments' ? ['add','delete'] : ['create','edit','delete','manage'];
  actions.forEach(action => { permissionDependencies[`${action}_${group}`] = `view_${group}`; });
}

// Legacy keys are accepted only at the boundary; granular rights take precedence.
export function normalizePermissions(input: readonly string[] = []): string[] {
  const rights = new Set(input);
  for (const [legacy, targets] of [
    ['view', ['view_closures', 'view_openings']],
    ['edit', ['create_closures', 'edit_closures', 'create_openings', 'edit_openings']],
  ] as const) {
    if (rights.has(legacy) && !targets.some(key => rights.has(key))) targets.forEach(key => rights.add(key));
  }
  if (rights.has('settings')) rights.add('manage_ldap');
  ['view', 'edit', 'settings', 'import', 'manage_notifications', 'delete_comments'].forEach(key => rights.delete(key));
  return [...rights];
}
export function hasRight(input: readonly string[] = [], permission: string): boolean {
  const rights = normalizePermissions(input);
  if (permission === 'view') return ['view_closures', 'view_openings'].some(key => rights.includes(key));
  if (permission === 'edit') return ['edit_closures', 'edit_openings'].some(key => rights.includes(key));
  return rights.includes(permission) && (!permissionDependencies[permission] || rights.includes(permissionDependencies[permission]));
}
export function storeRight(workType: string, action: string): string {
  return `${action}_${workType === 'Открытие' ? 'openings' : 'closures'}`;
}
export function allowedWorkTypes(input: readonly string[] = []): string[] {
  return ['Закрытие', 'Реконструкция', 'Открытие'].filter(type => hasRight(input, storeRight(type, 'view')));
}

export function toggleRight(input: string[], permission: string): string[] {
  const rights = new Set(input);
  if (rights.has(permission)) {
    rights.delete(permission);
    Object.entries(permissionDependencies).forEach(([action, view]) => { if (view === permission) rights.delete(action); });
  } else {
    rights.add(permission);
    if (permissionDependencies[permission]) rights.add(permissionDependencies[permission]);
  }
  return [...rights];
}

export const pagePermissions: Record<string, string> = {
  videoregs:'view_videoregs', dashboard:'view_dashboard', table:'view', calendar:'view_calendar', users:'view_users', roles:'view_roles',
  tus:'view_tus', shops:'view_shops', scheduler:'manage_scheduler', audit:'view_audit',
  settings:'manage_ldap', integrations:'manage_integrations', notifications:'view_notifications',
};
export function canAccessPage(input: readonly string[] = [], page: string): boolean {
  return page === 'profile' || (!!pagePermissions[page] && hasRight(input, pagePermissions[page]));
}
