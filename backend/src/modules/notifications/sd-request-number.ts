// Prefer the visible request number over IDs of related response objects.
export function extractSDRequestNumber(response: unknown): string {
  const readable = (value: unknown) => (typeof value === 'string' || typeof value === 'number') && String(value).trim() ? String(value).trim() : '';
  const find = (value: unknown, keys: string[], depth = 0): string => {
    if (!value || typeof value !== 'object' || depth > 8) return '';
    const object = value as Record<string, unknown>;
    for (const key of keys) { const result = readable(object[key]); if (result) return result; }
    for (const child of Object.values(object)) { const result = find(child, keys, depth + 1); if (result) return result; }
    return '';
  };
  return readable(response) || find(response, ['RequestNumber','requestNumber','TaskNumber','taskNumber','tasknumber','Number','number']) || find(response, ['TaskID','TaskId','taskId','task_id','Id','ID','id']);
}
