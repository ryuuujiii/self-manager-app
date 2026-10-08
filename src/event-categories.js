export const DEFAULT_EVENT_CATEGORIES = [
  { id: "university", label: "学校", color: "#8054c9" },
  { id: "work", label: "職場", color: "#85265c" },
  { id: "private", label: "遊び", color: "#708b19" },
  { id: "rest", label: "休み", color: "#2878d2" },
  { id: "event", label: "イベント", color: "#d73e45" },
  { id: "dining", label: "食事会", color: "#a78008" }
];
const LEGACY = [{ id: "study", label: "勉強", color: "#4d91e9" }, { id: "life", label: "生活", color: "#17ad75" }, { id: "other", label: "その他", color: "#9b9eaa" }];
export function validateEventCategory(value) {
  if (!value || typeof value.id !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(value.id)) return "カテゴリの識別子が不正です。";
  if (typeof value.label !== "string" || !value.label.trim() || value.label.length > 24) return "カテゴリ名は24文字以内で入力してください。";
  if (!/^#[a-f0-9]{6}$/i.test(value.color)) return "色を選んでください。";
  if (value.deleted != null && typeof value.deleted !== "boolean") return "カテゴリの状態が不正です。";
  return null;
}
export function eventCategoryCatalog(saved = [], events = []) {
  const result = new Map(DEFAULT_EVENT_CATEGORIES.map((item) => [item.id, item]));
  for (const item of LEGACY) if (events.some((event) => event.category === item.id)) result.set(item.id, item);
  for (const item of saved) result.set(item.id, item);
  return [...result.values()];
}
export function eventCategoryById(id, saved = [], events = []) {
  return eventCategoryCatalog(saved, events).find((item) => item.id === id) || LEGACY.find((item) => item.id === id) || { label: "カテゴリ未設定", color: "#9b9eaa" };
}
export function eventCategoryExists(id, saved = []) {
  return [...DEFAULT_EVENT_CATEGORIES, ...LEGACY, ...saved].some((item) => item.id === id);
}
