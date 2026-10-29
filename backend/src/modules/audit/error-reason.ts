export function getErrorReason(error: any, body?: unknown): string {
  const response = typeof error?.getResponse === 'function' ? error.getResponse() : undefined;
  const known: Record<string,string> = { P1001:'Не удалось подключиться к базе данных.', P2002:'Запись с такими данными уже существует.', P2003:'Запись связана с другими данными.', P2025:'Запись не найдена.', ECONNREFUSED:'Сервис отклонил подключение.', ETIMEDOUT:'Истекло время ожидания ответа сервиса.', ENOTFOUND:'Не удалось найти адрес сервиса.' };
  const message = (typeof response === 'string' ? response : response?.message) || known[error?.code] || error?.message || 'Неизвестная ошибка';
  let reason = (Array.isArray(message) ? message.join('; ') : String(message)).slice(0, 1600);
  const redact = (value: unknown, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 5) return;
    for (const [key,item] of Object.entries(value)) {
      if (/password|secret|token|api.?key|authorization|cookie|credential/i.test(key) && typeof item === 'string' && item.length >= 4) reason = reason.split(item).join('[REDACTED]');
      else if (item && typeof item === 'object') redact(item, depth + 1);
    }
  };
  redact(body);
  return reason.replace(/(https?:\/\/|postgres(?:ql)?:\/\/)([^\s/@]+):([^\s/@]+)@/gi,'$1[REDACTED]@').replace(/((?:password|secret|token|api[_-]?key|authorization)\s*[=:]\s*)([^\s&,;]+)/gi,'$1[REDACTED]').slice(0,1200);
}
