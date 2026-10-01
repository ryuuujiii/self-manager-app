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
  const offset = first.getDay();
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

export const REPEAT_RULES = ["none", "daily", "weekly", "monthly"];
export const REMINDER_LEADS = ["none", "at", "oneHour", "oneDay"];
function validateOptions(value, anchor) {
  if (value.repeatRule && !REPEAT_RULES.includes(value.repeatRule)) return "繰り返しの設定が不正です。";
  if (value.reminderLead && !REMINDER_LEADS.includes(value.reminderLead)) return "リマインダーの設定が不正です。";
  if (value.repeatRule && value.repeatRule !== "none" && !anchor) return "繰り返す場合は日付を指定してください。";
  if (value.repeatUntil && (!isValidDateKey(value.repeatUntil) || value.repeatUntil < anchor)) return "繰り返しの終了日を確認してください。";
  return null;
}
export function validateEvent(value) {
  if (!value.title?.trim()) return "予定のタイトルを入力してください。";
  if (!isValidDateKey(value.date)) return "正しい日付を指定してください。";
  if (!value.allDay && (!isValidTime(value.start) || !isValidTime(value.end))) return "開始・終了時刻を指定してください。";
  if (!value.allDay && value.end <= value.start) return "終了時刻は開始時刻より後にしてください。";
  if (!CATEGORIES[value.category]) return "カテゴリを選択してください。";
  return validateOptions(value, value.date);
}

export function validateTodo(value) {
  if (!value.title?.trim()) return "ToDoのタイトルを入力してください。";
  if (value.dueDate && !isValidDateKey(value.dueDate)) return "正しい期限日を指定してください。";
  if (value.dueTime && !value.dueDate) return "時刻を指定する場合は期限日も指定してください。";
  if (value.dueTime && !isValidTime(value.dueTime)) return "正しい期限時刻を指定してください。";
  if (!CATEGORIES[value.category]) return "カテゴリを選択してください。";
  if (value.reminderLead && value.reminderLead !== "none" && !value.dueDate) return "リマインダーには期限日を指定してください。";
  if (value.completedDates && (!Array.isArray(value.completedDates) || value.completedDates.some((date) => !isValidDateKey(date)))) return "完了履歴が不正です。";
  return validateOptions(value, value.dueDate);
}
export function occursOn(record, anchor, key) {
  if (!anchor || key < anchor || (record.repeatUntil && key > record.repeatUntil)) return false;
  const rule = record.repeatRule || "none";
  if (rule === "none") return key === anchor;
  if (rule === "daily") return true;
  const [year, month, day] = key.split("-").map(Number);
  const [baseYear, baseMonth, baseDay] = anchor.split("-").map(Number);
  if (rule === "weekly") {
    const difference = (Date.UTC(year, month - 1, day) - Date.UTC(baseYear, baseMonth - 1, baseDay)) / 86400000;
    return difference % 7 === 0;
  }
  if (rule === "monthly") return day === Math.min(baseDay, new Date(year, month, 0).getDate());
  return false;
}
export function todoOccurrence(todo, key) {
  if (!occursOn(todo, todo.dueDate, key)) return null;
  return { ...todo, occurrenceDate: key, completedAt: (todo.repeatRule && todo.repeatRule !== "none") ? (todo.completedDates?.includes(key) ? key : null) : todo.completedAt };
}
export function eventsForDay(events, key) {
  return events.filter((event) => occursOn(event, event.date, key)).map((event) => ({ ...event, occurrenceDate: key }))
    .sort((a, b) => (a.allDay ? "" : a.start).localeCompare(b.allDay ? "" : b.start));
}

export function todosForDay(todos, key) {
  return todos.map((todo) => todoOccurrence(todo, key)).filter(Boolean)
    .sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99"));
}

export function homeSummary(events, todos, key) {
  const todayEvents = eventsForDay(events, key);
  const todayTodos = todosForDay(todos, key);
  const overdueTodos = todos.filter((todo) => (!todo.repeatRule || todo.repeatRule === "none") && !todo.completedAt && todo.dueDate && todo.dueDate < key)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    todayEvents,
    todayTodos,
    overdueTodos,
    openCount: todayTodos.filter((todo) => !todo.completedAt).length + overdueTodos.length
  };
}

export function remindersForWindow(events, todos, now = new Date()) {
  const start = addDays(dateKey(now), -1);
  const items = [];
  for (let offset = 0; offset < 10; offset++) {
    const key = addDays(start, offset);
    for (const [kind, records] of [["event", eventsForDay(events, key)], ["todo", todosForDay(todos, key)]]) {
      for (const record of records) {
        if (!record.reminderLead || record.reminderLead === "none" || (kind === "todo" && record.completedAt)) continue;
        const time = kind === "event" ? (record.allDay ? "09:00" : record.start) : (record.dueTime || "09:00");
        const [year, month, day] = key.split("-").map(Number);
        const [hour, minute] = time.split(":").map(Number);
        const scheduled = new Date(year, month - 1, day, hour, minute);
        const lead = record.reminderLead === "oneDay" ? 86400000 : record.reminderLead === "oneHour" ? 3600000 : 0;
        const trigger = new Date(scheduled.getTime() - lead);
        if (trigger >= new Date(now.getTime() - 86400000) && trigger <= new Date(now.getTime() + 7 * 86400000)) {
          items.push({ kind, id: record.id, title: record.title, occurrenceDate: key, triggerAt: trigger, scheduledAt: scheduled });
        }
      }
    }
  }
  return items.sort((a, b) => a.triggerAt - b.triggerAt);
}
