import { useStore } from '../store/useStore';
import type { SystemUser } from '../types';
export function applyCurrentUser(profile: Partial<SystemUser>) {
  const current = useStore.getState().currentUser;
  if (!current || (profile.id && profile.id !== current.id)) return;
  const updated = { ...current, ...profile };
  useStore.setState({ currentUser: updated });
  localStorage.setItem('currentUser', JSON.stringify(updated));
  document.documentElement.dataset.theme = updated.theme || 'light';
}
