export const SYSTEM_TASKS = ['sdRequest','sdDemolitionMonitoring','sdDemolitionPrintstat','sdDemolitionInternet'];
export function systemRuleSchedule(task:string) {return {channel:'intradesk',eventType:task==='sdRequest'?'closureDate':'demolitionDate',offsetType:task==='sdRequest'?'business_days':'on_event',days:task==='sdRequest'?1:0};}
