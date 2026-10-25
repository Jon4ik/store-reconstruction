export function getAuditErrorReason(details: Record<string, unknown>): string {
  const value = details.errorReason || details.message || (typeof details.error === 'string' ? details.error : '');
  if (Array.isArray(value)) return value.map(String).join('; ');
  if (typeof value === 'string' && value.trim()) return value;
  return `Причина ошибки не сохранена для этого события${details.statusCode ? ` (HTTP ${details.statusCode})` : ''}.`;
}
