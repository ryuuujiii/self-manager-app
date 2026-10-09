import { addDays, eventsForDay, isValidDateKey } from "./domain.js?v=29";
import { validateWorkShift } from "./work.js?v=29";

export const requestId = (workplaceId, date) => `${workplaceId}:${date}`;
export function validateShiftRequest(value, workplaces) {
  if (!value || !isValidDateKey(value.date) || value.id !== requestId(value.workplaceId, value.date)) return "希望の日付・IDが不正です。";
  if (!workplaces.some((item) => item.id === value.workplaceId)) return "勤務先を選んでください。";
  if (!["work", "off"].includes(value.status)) return "勤務希望または休みを選んでください。";
  if (value.status === "work") return validateWorkShift(value, workplaces);
  if (typeof value.note !== "string" || value.note.length > 2000) return "メモは2000文字以内で入力してください。";
  return null;
}
// Keep one daily record per date; bulk entry does not change the storage format.
export function buildShiftRequests(template, dates, existing = [], now = new Date().toISOString()) {
  return [...new Set(dates)].sort().map((date) => {
    const id = requestId(template.workplaceId, date);
    const previous = existing.find((item) => item.id === id);
    return { ...template, id, date, createdAt: previous?.createdAt || now, updatedAt: now };
  });
}
export function validateRequestBatch(records, workplaces, period) {
  if (!records.length) return "日付を選んでください。";
  const ids = new Set();
  for (const record of records) {
    const error = validateShiftRequest(record, workplaces);
    if (error) return error;
    if (record.workplaceId !== records[0].workplaceId || ids.has(record.id)) return "勤務先・日付の組み合わせが不正です。";
    if (period && (record.date < period.start || record.date > period.end)) return "希望期間内の日付を選んでください。";
    ids.add(record.id);
  }
  return null;
}
function interval(date, start, end) {
  const begin = Number(start.slice(0,2)) * 60 + Number(start.slice(3));
  let finish = Number(end.slice(0,2)) * 60 + Number(end.slice(3));
  if (finish <= begin) finish += 1440;
  return { date, begin, finish };
}
export function requestConflicts(request, events, shifts = []) {
  if (!request || request.status !== "work") return [];
  const target = interval(request.date, request.start, request.end);
  const previous = addDays(request.date, -1), next = addDays(request.date, 1);
  const result = [];
  for (const date of [previous, request.date, next]) {
    const offset = date === previous ? -1440 : date === next ? 1440 : 0;
    const appointments = eventsForDay(events, date).map((item) => ({ ...item, kind: "event", date }));
    const confirmed = shifts.filter((item) => item.date === date && item.sourceRequestId !== request.id).map((item) => ({ ...item, title: "確定シフト", kind: "shift" }));
    for (const item of [...appointments, ...confirmed]) {
      const span = item.allDay ? { begin: 0, finish: 1440 } : interval(date, item.start, item.end);
      if (target.begin < span.finish + offset && span.begin + offset < target.finish) result.push({ ...item, conflictDate: date });
    }
  }
  return result;
}
export function requestConversion(requests, shifts, workplaceId, start, end, now = new Date().toISOString()) {
  const candidates = requests.filter((item) => item.workplaceId === workplaceId && item.status === "work" && item.date >= start && item.date <= end);
  const skipped = [], additions = [];
  for (const item of candidates) {
    if (shifts.some((shift) => shift.sourceRequestId === item.id || (shift.workplaceId === item.workplaceId && shift.date === item.date && shift.start === item.start && shift.end === item.end))) { skipped.push(item); continue; }
    additions.push({ id: `request-shift-${item.id}`, sourceRequestId: item.id, workplaceId: item.workplaceId, date: item.date, start: item.start, end: item.end, breakMinutes: item.breakMinutes, note: item.note || "", createdAt: now, updatedAt: now });
  }
  return { additions, skipped };
}
