import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type SettingsNoticeProps = {
  message: string;
  variant?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
};

export default function SettingsNotice({ message, variant = 'info', onDismiss }: SettingsNoticeProps) {
  if (!message) return null;

  const styles = {
    success: 'border-green-300 bg-green-50 text-green-900 dark-readable-success',
    error: 'border-red-300 bg-red-50 text-red-900 dark-readable-error',
    info: 'border-blue-300 bg-blue-50 text-blue-900 dark-readable-info',
  };
  const Icon = variant === 'success' ? CheckCircle2 : variant === 'error' ? AlertCircle : Info;

  return (
    <div role="status" aria-live="polite" className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-sm font-semibold shadow-sm ${styles[variant]}`}>
      <Icon size={20} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 break-words">{message}</p>
      {onDismiss && <button type="button" onClick={onDismiss} aria-label="Закрыть уведомление" className="shrink-0 rounded p-1 hover:bg-black/5"><X size={16}/></button>}
    </div>
  );
}
