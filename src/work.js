import { isValidDateKey } from "./domain.js";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function minuteOfDay(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function validateWorkplace(value) {
  if (typeof value.id !== "string" || !value.id) return "勤務先のIDが不正です。";
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 120) return "勤務先名を入力してください。";
  if (!Number.isSafeInteger(value.hourlyWage) || value.hourlyWage < 1 || value.hourlyWage > 1000000) return "時給は1円以上の整数で入力してください。";
  if (value.payday != null && (!Number.isInteger(value.payday) || value.payday < 1 || value.payday > 31)) return "給料日は1〜31日で指定してください。";
  if (value.location != null && (typeof value.location !== "string" || value.location.length > 200)) return "場所は200文字以内で入力してください。";
  if (value.note != null && (typeof value.note !== "string" || value.note.length > 2000)) return "メモは2000文字以内で入力してください。";
  return null;
}

export function shiftMinutes(shift) {
  if (!timePattern.test(shift.start) || !timePattern.test(shift.end)) return NaN;
  const start = minuteOfDay(shift.start);
  let end = minuteOfDay(shift.end);
  if (end <= start) end += 1440;
  return end - start - shift.breakMinutes;
}

export function validateWorkShift(value, workplaces) {
  if (typeof value.id !== "string" || !value.id) return "シフトのIDが不正です。";
  if (typeof value.workplaceId !== "string" || !workplaces.some((item) => item.id === value.workplaceId)) return "勤務先を選択してください。";
  if (!isValidDateKey(value.date)) return "正しい勤務日を指定してください。";
  if (!timePattern.test(value.start) || !timePattern.test(value.end)) return "開始・終了時刻を指定してください。";
  if (value.start === value.end) return "開始時刻と終了時刻を変えてください。";
  if (!Number.isInteger(value.breakMinutes) || value.breakMinutes < 0 || value.breakMinutes > 1439) return "休憩時間を正しく入力してください。";
  if (shiftMinutes(value) <= 0) return "休憩時間が勤務時間以上です。";
  if (value.note != null && (typeof value.note !== "string" || value.note.length > 2000)) return "メモは2000文字以内で入力してください。";
  return null;
}

export function shiftPay(shift, workplace) {
  return Math.round(shiftMinutes(shift) * workplace.hourlyWage / 60);
}

export function shiftsForDay(shifts, key) {
  return shifts.filter((shift) => shift.date === key).sort((a, b) => a.start.localeCompare(b.start));
}

export function shiftsForMonth(shifts, month) {
  return shifts.filter((shift) => shift.date.startsWith(`${month}-`)).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export function nextShift(shifts, now = new Date()) {
  const active = shifts.filter((shift) => {
    const [year, month, day] = shift.date.split("-").map(Number);
    const start = new Date(year, month - 1, day, ...shift.start.split(":").map(Number));
    const end = new Date(start.getTime() + shiftMinutes({ ...shift, breakMinutes: 0 }) * 60000);
    return end > now;
  });
  return active.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))[0] || null;
}

export function workSummary(shifts, workplaces, month) {
  const workplaceById = new Map(workplaces.map((item) => [item.id, item]));
  const monthly = shiftsForMonth(shifts, month);
  const valid = monthly.filter((shift) => workplaceById.has(shift.workplaceId));
  const minutes = valid.reduce((total, shift) => total + shiftMinutes(shift), 0);
  const pay = valid.reduce((total, shift) => total + shiftPay(shift, workplaceById.get(shift.workplaceId)), 0);
  return { count: new Set(valid.map((shift) => shift.date)).size, shiftCount: valid.length, minutes, pay, shifts: valid };
}
