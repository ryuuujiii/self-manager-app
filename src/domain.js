export const CATEGORIES = {
  university: { label: "大学", color: "#7164db" },
  work: { label: "仕事", color: "#f28b54" },
  private: { label: "プライベート", color: "#e76995" },
  study: { label: "勉強", color: "#4d91e9" },
  life: { label: "生活", color: "#17ad75" },
  other: { label: "その他", color: "#9b9eaa" }
};

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(key, count) {
  const [year, month, day] = key.split("-").map(Number);
  return dateKey(new Date(year, month - 1, day + count));
}

export function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(year, monthIndex + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => dateKey(new Date(year, monthIndex, index - offset + 1)));
}

export function formatDay(key, options = {}) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", options).format(new Date(year, month - 1, day));
}

export function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return dateKey(new Date(year, month - 1, day)) === value;
}

function isValidTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateEvent(value) {
  if (!value.title?.trim()) return "予定のタイトルを入力してください。";
  if (!isValidDateKey(value.date)) return "正しい日付を指定してください。";
  if (!value.allDay && (!isValidTime(value.start) || !isValidTime(value.end))) return "開始・終了時刻を指定してください。";
  if (!value.allDay && value.end <= value.start) return "終了時刻は開始時刻より後にしてください。";
  if (!CATEGORIES[value.category]) return "カテゴリを選択してください。";
  return null;
}

export function validateTodo(value) {
  if (!value.title?.trim()) return "ToDoのタイトルを入力してください。";
  if (value.dueDate && !isValidDateKey(value.dueDate)) return "正しい期限日を指定してください。";
  if (value.dueTime && !value.dueDate) return "時刻を指定する場合は期限日も指定してください。";
  if (value.dueTime && !isValidTime(value.dueTime)) return "正しい期限時刻を指定してください。";
  if (!CATEGORIES[value.category]) return "カテゴリを選択してください。";
  return null;
}

export function eventsForDay(events, key) {
  return events.filter((event) => event.date === key)
    .sort((a, b) => (a.allDay ? "" : a.start).localeCompare(b.allDay ? "" : b.start));
}

export function todosForDay(todos, key) {
  return todos.filter((todo) => todo.dueDate === key)
    .sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99"));
}

export function homeSummary(events, todos, key) {
  const todayEvents = eventsForDay(events, key);
  const todayTodos = todosForDay(todos, key);
  const overdueTodos = todos.filter((todo) => !todo.completedAt && todo.dueDate && todo.dueDate < key)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    todayEvents,
    todayTodos,
    overdueTodos,
    openCount: todayTodos.filter((todo) => !todo.completedAt).length + overdueTodos.length
  };
}
