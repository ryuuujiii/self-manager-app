import { isValidDateKey } from "./domain.js?v=23";
import { addDays } from "./domain.js?v=23";
import { nominalPayday, paydayForMonth, shiftMonth } from "./pay-cycle.js?v=23";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function minuteOfDay(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function validateWorkplace(value) {
  if (typeof value.id !== "string" || !value.id) return "勤務先のIDが不正です。";
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 120) return "勤務先名を入力してください。";
  if (!Number.isSafeInteger(value.hourlyWage) || value.hourlyWage < 1 || value.hourlyWage > 1000000) return "時給は1円以上の整数で入力してください。";
  if (value.transportPerDay != null && (!Number.isSafeInteger(value.transportPerDay) || value.transportPerDay < 0 || value.transportPerDay > 1000000)) return "交通費は1日あたり0〜100万円の整数で入力してください。";
  if (value.payday != null && (!Number.isInteger(value.payday) || value.payday < 1 || value.payday > 31)) return "給料日は1〜31日で指定してください。";
  if (value.closingDay != null && (!Number.isInteger(value.closingDay) || value.closingDay < 1 || value.closingDay > 31)) return "締め日は1〜31日で指定してください。";
  if (value.payMonthOffset != null && ![0, 1].includes(value.payMonthOffset)) return "給料の支払月を選んでください。";
  if (value.holidayShift != null && !["previous", "next"].includes(value.holidayShift)) return "給料日の休日調整を選んでください。";
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

export function workPeriod(month, workplace) {
  if (!workplace) {
    const start = `${month}-01`;
    return { month, start, end: addDays(`${shiftMonth(month, 1)}-01`, -1), payday: null };
  }
  const day = workplace.closingDay ?? 1;
  const start = addDays(nominalPayday(month, day), 1);
  const end = nominalPayday(shiftMonth(month, 1), day);
  const payRule = { salaryDay: workplace.payday, holidayShift: workplace.holidayShift || "previous" };
  const endMonth = end.slice(0, 7);
  let offset = workplace.payMonthOffset ?? 0;
  if (workplace.payMonthOffset == null && workplace.payday) {
    while (paydayForMonth(shiftMonth(endMonth, offset), payRule).actual <= end) offset += 1;
  }
  const payMonth = shiftMonth(endMonth, offset);
  const payday = workplace.payday ? paydayForMonth(payMonth, payRule) : null;
  return { month, start, end, payday };
}

export function workPeriodForDate(key, workplace) {
  if (!workplace) return key.slice(0, 7);
  const month = key.slice(0, 7);
  for (let offset = -2; offset <= 1; offset++) {
    const candidate = shiftMonth(month, offset);
    const period = workPeriod(candidate, workplace);
    if (period.start <= key && key <= period.end) return candidate;
  }
  throw new Error("この日付の締め期間を計算できません。");
}

export function workPeriodSummary(shifts, workplace, month) {
  const period = workPeriod(month, workplace);
  const monthly = workplace ? shifts.filter((shift) => shift.workplaceId === workplace.id && shift.date >= period.start && shift.date <= period.end) : [];
  const minutes = monthly.reduce((total, shift) => total + shiftMinutes(shift), 0);
  const count = new Set(monthly.map((shift) => shift.date)).size;
  const wagePay = monthly.reduce((total, shift) => total + shiftPay(shift, workplace), 0);
  const transportPay = count * (workplace?.transportPerDay || 0);
  return { ...period, shifts: monthly.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)), count, minutes, wagePay, transportPay, pay: wagePay + transportPay };
}

export function shiftPatterns(shifts, workplaces, limit = 6) {
  const names = new Map(workplaces.map((item) => [item.id, item.name]));
  const grouped = new Map();
  for (const shift of shifts) {
    if (!names.has(shift.workplaceId)) continue;
    const key = [shift.workplaceId, shift.start, shift.end, shift.breakMinutes].join("|");
    const previous = grouped.get(key);
    grouped.set(key, { workplaceId: shift.workplaceId, workplaceName: names.get(shift.workplaceId), start: shift.start, end: shift.end, breakMinutes: shift.breakMinutes, count: (previous?.count || 0) + 1, latest: previous?.latest > shift.date ? previous.latest : shift.date });
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest)).slice(0, limit);
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
  const wages = valid.reduce((total, shift) => total + shiftPay(shift, workplaceById.get(shift.workplaceId)), 0);
  const paidDays = new Map(valid.map((shift) => [JSON.stringify([shift.workplaceId, shift.date]), shift.workplaceId]));
  const transportPay = [...paidDays.values()].reduce((total, workplaceId) => total + (workplaceById.get(workplaceId)?.transportPerDay || 0), 0);
  const pay = wages + transportPay;
  return { count: new Set(valid.map((shift) => shift.date)).size, shiftCount: valid.length, minutes, pay, shifts: valid };
}
