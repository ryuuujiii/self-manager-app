import { addDays, dateKey } from "./domain.js?v=14";
import { adjustToBusinessDay, OFFICIAL_HOLIDAYS_THROUGH } from "./jp-holidays.js?v=14";

export function shiftMonth(month, delta) {
  const [year, number] = month.split("-").map(Number);
  return dateKey(new Date(year, number - 1 + delta, 1)).slice(0, 7);
}

export function nominalPayday(month, day) {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(year, number, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export function paydayForMonth(month, wallet) {
  const nominal = nominalPayday(month, wallet.salaryDay);
  const actual = adjustToBusinessDay(nominal, wallet.holidayShift || "previous");
  return { nominal, actual };
}

export function calendarPeriod(month) {
  const [year, number] = month.split("-").map(Number);
  return {
    month,
    start: `${month}-01`,
    end: `${month}-${String(new Date(year, number, 0).getDate()).padStart(2, "0")}`,
    nextPayday: null,
    provisional: false
  };
}

export function payPeriod(month, wallet) {
  if (!wallet?.salaryDay) return calendarPeriod(month);
  const current = paydayForMonth(month, wallet);
  const next = paydayForMonth(shiftMonth(month, 1), wallet);
  return {
    month,
    start: current.actual,
    end: addDays(next.actual, -1),
    currentPayday: current,
    nextPayday: next,
    provisional: Number(current.nominal.slice(0, 4)) > OFFICIAL_HOLIDAYS_THROUGH ||
      Number(next.nominal.slice(0, 4)) > OFFICIAL_HOLIDAYS_THROUGH
  };
}

export function payPeriodForDate(key, wallet) {
  if (!wallet?.salaryDay) return key.slice(0, 7);
  const month = key.slice(0, 7);
  for (let offset = -2; offset <= 1; offset++) {
    const candidate = shiftMonth(month, offset);
    const period = payPeriod(candidate, wallet);
    if (period.start <= key && key <= period.end) return candidate;
  }
  throw new Error("この日付の給料日区切りを計算できません。");
}

export function periodGrid(start, end) {
  const [year, month, day] = start.split("-").map(Number);
  const firstWeekday = new Date(year, month - 1, day).getDay();
  const first = addDays(start, -firstWeekday);
  const keys = [];
  for (let cursor = first; keys.length < 56; cursor = addDays(cursor, 1)) {
    keys.push(cursor);
    if (cursor >= end && keys.length % 7 === 0) return keys;
  }
  throw new Error("カレンダーの期間が長すぎます。");
}

export function periodSummary(transactions, start, end) {
  const records = transactions.filter((item) => item.date >= start && item.date <= end);
  const income = records.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = records.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  return { records, income, expense, net: income - expense };
}
