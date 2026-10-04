import { addDays, dateKey, isValidDateKey } from "./domain.js?v=22";

export const CHECKLIST_CATEGORIES = { university: "大学", work: "バイト", outside: "外出", travel: "旅行", other: "その他" };
export const WISHLIST_CATEGORIES = { daily: "日用品", fashion: "ファッション", digital: "デジタル", hobby: "趣味", other: "その他" };
export const MEMO_CATEGORIES = { research: "研究", university: "大学", life: "生活", travel: "旅行", idea: "アイデア", other: "その他" };
export const PRIORITIES = { high: "高い", normal: "ふつう", later: "いつか" };

const validText = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const optionalText = (value, max) => value == null || (typeof value === "string" && value.length <= max);
const validWebUrl = (value) => {
  if (!value) return true;
  if (typeof value !== "string" || value.length > 2000) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

export function validateHabit(value) {
  if (!value?.id || !validText(value.title, 120)) return "習慣名を入力してください。";
  if (!isValidDateKey(value.startDate)) return "開始日を確認してください。";
  if (!Array.isArray(value.days) || !value.days.length || value.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || new Set(value.days).size !== value.days.length) return "実施する曜日を選んでください。";
  if (!optionalText(value.note, 2000)) return "メモを確認してください。";
  return null;
}

export function validateHabitRecord(value) {
  if (!value?.habitId || value.id !== `${value.habitId}:${value.date}` || !isValidDateKey(value.date) || !value.completedAt) return "習慣のチェック履歴が不正です。";
  return null;
}

export function habitDueOn(habit, key) {
  if (key < habit.startDate) return false;
  const [year, month, day] = key.split("-").map(Number);
  return habit.days.includes(new Date(year, month - 1, day).getDay());
}

export function habitProgress(habit, records, today = dateKey()) {
  const completed = new Set(records.filter((item) => item.habitId === habit.id).map((item) => item.date));
  const [year, month, day] = today.split("-").map(Number);
  const first = addDays(today, -new Date(year, month - 1, day).getDay());
  const week = Array.from({ length: 7 }, (_, index) => addDays(first, index));
  const weekDue = week.filter((key) => habitDueOn(habit, key));
  const weekDone = weekDue.filter((key) => completed.has(key));
  let cursor = habitDueOn(habit, today) && !completed.has(today) ? addDays(today, -1) : today;
  let streak = 0;
  for (let count = 0; count < 3660 && cursor >= habit.startDate; count++, cursor = addDays(cursor, -1)) {
    if (!habitDueOn(habit, cursor)) continue;
    if (!completed.has(cursor)) break;
    streak++;
  }
  return { todayDue: habitDueOn(habit, today), todayDone: completed.has(today), week, weekDue: weekDue.length, weekDone: weekDone.length, completed, streak };
}

export function validateChecklist(value) {
  if (!value?.id || !validText(value.title, 120)) return "リスト名を入力してください。";
  if (!CHECKLIST_CATEGORIES[value.category]) return "用途を選んでください。";
  if (!Array.isArray(value.items) || value.items.length > 200 || value.items.some((item) => !item?.id || !validText(item.title, 120) || typeof item.checked !== "boolean")) return "持ち物の項目を確認してください。";
  return null;
}

export function mergeChecklistItems(previous = [], lines, createId = () => crypto.randomUUID()) {
  const used = new Set();
  return lines.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 200).map((title) => {
    const old = previous.find((item) => !used.has(item.id) && item.title === title);
    if (old) { used.add(old.id); return old; }
    return { id: createId(), title, checked: false };
  });
}

export function validateShoppingItem(value) {
  if (!value?.id || !validText(value.title, 120)) return "買う物を入力してください。";
  if (!optionalText(value.quantity, 80) || !optionalText(value.note, 1000)) return "数量・メモを確認してください。";
  if (value.checkedAt != null && typeof value.checkedAt !== "string") return "購入状態が不正です。";
  return null;
}

export function validateWishlistItem(value) {
  if (!value?.id || !validText(value.title, 120)) return "ほしい物の名前を入力してください。";
  if (value.price != null && (!Number.isSafeInteger(value.price) || value.price < 0 || value.price > 1e10)) return "金額は0円以上の整数で入力してください。";
  if (!WISHLIST_CATEGORIES[value.category] || !PRIORITIES[value.priority]) return "カテゴリと欲しい度を選んでください。";
  if (!validWebUrl(value.url) || !validWebUrl(value.imageUrl)) return "URLはhttps://から入力してください。";
  if (!optionalText(value.note, 2000)) return "メモを確認してください。";
  return null;
}

export function wishlistTotal(items) {
  return items.filter((item) => !item.purchasedAt).reduce((sum, item) => sum + (item.price || 0), 0);
}

export function validateMemo(value) {
  if (!value?.id || !validText(value.title, 120)) return "メモの見出しを入力してください。";
  if (!optionalText(value.body, 10000) || !MEMO_CATEGORIES[value.category]) return "メモの内容とカテゴリを確認してください。";
  return null;
}
