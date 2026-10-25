import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { getPageResources, PageResource } from '../config/pageResources';
export function usePageData(page: string) {
  const { currentUser, isAddModalOpen, isEditing } = useStore();
  const id = currentUser?.id;
  const permissions = [...(currentUser?.permissions || [])].sort().join('|');
  useEffect(() => {
    if (!id) return;
    const resources = getPageResources(page, isAddModalOpen, isEditing);
    let busy = false, active = true;
    const refresh = async () => {
      if (!active || busy || document.visibilityState === 'hidden') return;
      busy = true;
      const state = useStore.getState();
      const loaders: Record<PageResource, () => Promise<void>> = { projects: state.loadProjects, tus: state.loadTUs, users: state.loadUsers, roles: state.loadRoles, audit: state.loadAuditLog };
      try { await Promise.all(resources.map(resource => loaders[resource]())); }
      finally { busy = false; }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [id, permissions, page, isAddModalOpen, isEditing]);
}
