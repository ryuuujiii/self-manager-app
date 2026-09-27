import { CATEGORIES, dateKey, eventsForDay, formatDay, homeSummary, monthGrid, todosForDay, validateEvent, validateTodo } from "./domain.js";
import { deleteRecord, exportBackup, getAll, importBackup, openDatabase, putRecord } from "./db.js";
import { icon } from "./icons.js";

const root = document.querySelector("#app");
const toastElement = document.querySelector("#toast");
const TABS = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "schedule", label: "予定", icon: "calendar" },
  { id: "money", label: "お金", icon: "money" },
  { id: "work", label: "仕事", icon: "work" },
  { id: "life", label: "生活", icon: "life" }
];

const state = {
  db: null,
  events: [],
  todos: [],
  tab: "home",
  page: null,
  scheduleMode: "calendar",
  selectedDate: dateKey(),
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  editor: null,
  busy: false
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function displayDate(key) {
  return formatDay(key, { month: "long", day: "numeric", weekday: "short" });
}

function weekdayLabel(key) {
  return formatDay(key, { weekday: "short" });
}

function clockRange(event) {
  return event.allDay ? "終日" : `${event.start}–${event.end}`;
}

function toast(message, isError = false) {
  toastElement.textContent = message;
  toastElement.classList.toggle("error", isError);
  toastElement.classList.add("visible");
  clearTimeout(toastElement.timer);
  toastElement.timer = setTimeout(() => toastElement.classList.remove("visible"), 3500);
}

async function refresh() {
  [state.events, state.todos] = await Promise.all([getAll(state.db, "events"), getAll(state.db, "todos")]);
  render();
}

function header({ eyebrow, title, actions = "", back = false }) {
  return `<header class="screen-header">
    <div class="header-top">
      ${back ? `<button class="icon-button" data-action="close-page" aria-label="戻る">${icon("arrowLeft", 22)}</button>` : `<span class="brand-mark" aria-hidden="true">${icon("check", 18)}</span>`}
      <span class="brand-title">自分管理</span>
      <span class="header-spacer"></span>
      ${actions}
    </div>
    ${eyebrow ? `<p class="eyebrow">${escapeHTML(eyebrow)}</p>` : ""}
    <h1>${escapeHTML(title)}</h1>
  </header>`;
}

function renderHome() {
  const today = dateKey();
  const summary = homeSummary(state.events, state.todos, today);
  const completedCount = summary.todayTodos.filter((item) => item.completedAt).length;
  return `<div class="screen home-screen">
    ${header({
      eyebrow: `${formatDay(today, { year: "numeric", month: "long", day: "numeric" })}（${weekdayLabel(today)}）`,
      title: `${Number(today.slice(-2))}日のまとめ`,
      actions: `<button class="icon-button" data-action="settings" aria-label="設定">${icon("settings", 21)}</button>`
    })}
    <main class="screen-content">
      <section class="welcome-band"><div><span class="band-kicker">TODAY AT A GLANCE</span><strong>今日の自分に必要なこと</strong><span>予定とやることを、ここでまとめて確認。</span></div><span class="band-icon">${icon("sparkle", 29)}</span></section>
      <div class="overview-grid">
        <button class="overview-tile" data-action="goto-schedule"><span class="tile-icon blue">${icon("calendar", 20)}</span><strong>${summary.todayEvents.length}</strong><span>今日の予定</span></button>
        <button class="overview-tile" data-action="goto-todos"><span class="tile-icon pink">${icon("check", 20)}</span><strong>${summary.openCount}</strong><span>残りのToDo</span></button>
      </div>
      <section class="content-card">
        <div class="section-heading"><div><span class="section-kicker green">SCHEDULE</span><h2>今日の予定</h2></div><button class="text-link" data-action="goto-schedule">予定を見る ${icon("chevron", 14)}</button></div>
        ${summary.todayEvents.length ? summary.todayEvents.slice(0, 4).map(renderEventRow).join("") : `<div class="empty-inline"><span class="empty-icon blue">${icon("calendar", 22)}</span><p>今日の予定はありません</p></div>`}
        <button class="inline-add" data-action="add-event">${icon("plus", 17)} 予定を追加</button>
      </section>
      <section class="content-card">
        <div class="section-heading"><div><span class="section-kicker pink">TO DO</span><h2>今日のToDo</h2></div><span class="section-count">${completedCount} / ${summary.todayTodos.length} 完了</span></div>
        ${summary.overdueTodos.length ? `<div class="overdue-note">期限を過ぎたToDoが ${summary.overdueTodos.length} 件あります</div>${summary.overdueTodos.slice(0, 2).map((todo) => renderTodoRow(todo, true)).join("")}` : ""}
        ${summary.todayTodos.length ? summary.todayTodos.slice(0, 5).map((todo) => renderTodoRow(todo, false)).join("") : `<div class="empty-inline"><span class="empty-icon pink">${icon("check", 22)}</span><p>今日のToDoはありません</p></div>`}
        <button class="inline-add" data-action="add-todo">${icon("plus", 17)} ToDoを追加</button>
      </section>
      <section class="coming-card"><div class="coming-icon">${icon("wallet", 22)}</div><div><strong>これからの機能</strong><p>お金・仕事・生活の情報も、完成したらここに集まります。</p></div></section>
    </main>
  </div>`;
}

function renderEventRow(event) {
  const category = CATEGORIES[event.category] || CATEGORIES.other;
  return `<button class="event-row" data-action="edit-event" data-id="${escapeHTML(event.id)}">
    <span class="event-stripe" style="--stripe:${category.color}"></span>
    <span class="event-details"><strong>${escapeHTML(event.title)}</strong><span>${escapeHTML(clockRange(event))} <span class="middot">·</span> ${escapeHTML(category.label)}</span></span>
    ${icon("chevron", 16)}
  </button>`;
}

function renderTodoRow(todo, overdue = false) {
  const category = CATEGORIES[todo.category] || CATEGORIES.other;
  return `<div class="todo-row ${todo.completedAt ? "done" : ""}">
    <button class="todo-check ${todo.completedAt ? "checked" : ""}" data-action="toggle-todo" data-id="${escapeHTML(todo.id)}" aria-label="${todo.completedAt ? "未完了に戻す" : "完了にする"}: ${escapeHTML(todo.title)}">${todo.completedAt ? icon("check", 15) : ""}</button>
    <button class="todo-details" data-action="edit-todo" data-id="${escapeHTML(todo.id)}"><strong>${escapeHTML(todo.title)}</strong><span>${overdue ? `期限 ${escapeHTML(displayDate(todo.dueDate))}` : todo.dueTime ? `${escapeHTML(todo.dueTime)} · ` : ""}${escapeHTML(category.label)}</span></button>
    ${overdue ? `<span class="overdue-tag">期限超過</span>` : ""}
  </div>`;
}

function renderCalendar() {
  const today = dateKey();
  const cells = monthGrid(state.year, state.month);
  const byDate = new Map();
  for (const event of state.events) byDate.set(event.date, [...(byDate.get(event.date) || []), CATEGORIES[event.category]?.color || "#9b9eaa"]);
  for (const todo of state.todos) if (todo.dueDate) byDate.set(todo.dueDate, [...(byDate.get(todo.dueDate) || []), todo.completedAt ? "#bfc8c4" : "#e76995"]);
  const selectedEvents = eventsForDay(state.events, state.selectedDate);
  const selectedTodos = todosForDay(state.todos, state.selectedDate);
  return `<div class="calendar-panel">
    <div class="month-control"><button class="icon-button" data-action="previous-month" aria-label="前月">${icon("arrowLeft", 20)}</button><h2>${state.year}年${state.month + 1}月</h2><button class="icon-button" data-action="next-month" aria-label="翌月">${icon("chevron", 20)}</button></div>
    <div class="weekdays"><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span><span>日</span></div>
    <div class="calendar-grid">${cells.map((key) => {
      const inMonth = Number(key.slice(5, 7)) === state.month + 1;
      const dots = (byDate.get(key) || []).slice(0, 3);
      return `<button class="day-cell ${inMonth ? "" : "outside"} ${key === today ? "today" : ""} ${key === state.selectedDate ? "selected" : ""}" data-action="select-day" data-date="${key}" aria-label="${escapeHTML(displayDate(key))}"><span>${Number(key.slice(-2))}</span><span class="day-dots">${dots.map((color) => `<i style="background:${color}"></i>`).join("")}</span></button>`;
    }).join("")}</div>
    <div class="day-agenda"><div class="section-heading"><div><span class="section-kicker green">SELECTED DAY</span><h2>${escapeHTML(displayDate(state.selectedDate))}</h2></div><button class="small-today" data-action="today">今日</button></div>
      ${selectedEvents.length || selectedTodos.length ? `${selectedEvents.map(renderEventRow).join("")}${selectedTodos.map((todo) => renderTodoRow(todo)).join("")}` : `<div class="empty-inline"><p>この日の予定・ToDoはありません</p></div>`}
    </div>
  </div>`;
}

function renderTodoList() {
  const today = dateKey();
  const sorted = [...state.todos].sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99") || (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99"));
  const open = sorted.filter((todo) => !todo.completedAt);
  const done = sorted.filter((todo) => todo.completedAt);
  return `<div class="todo-list-panel">
    <div class="section-heading"><div><span class="section-kicker green">YOUR TASKS</span><h2>やること一覧</h2></div><span class="section-count">未完了 ${open.length} 件</span></div>
    ${open.length ? open.map((todo) => `<div class="todo-list-item">${renderTodoRow(todo)}<p class="todo-due">${todo.dueDate ? `${todo.dueDate < today ? "期限超過 · " : "期限 · "}${escapeHTML(displayDate(todo.dueDate))}` : "期限なし"}</p></div>`).join("") : `<div class="empty-large"><span>${icon("check", 30)}</span><strong>未完了のToDoはありません</strong><p>やることを登録すると、ここで管理できます。</p></div>`}
    ${done.length ? `<div class="completed-heading">完了済み <span>${done.length}</span></div>${done.map((todo) => `<div class="todo-list-item">${renderTodoRow(todo)}</div>`).join("")}` : ""}
  </div>`;
}

function renderSchedule() {
  return `<div class="screen schedule-screen">
    ${header({ eyebrow: "予定とやることをひとつに", title: "予定", actions: `<button class="icon-button" data-action="settings" aria-label="設定">${icon("settings", 21)}</button>` })}
    <main class="screen-content">
      <div class="segmented" role="tablist" aria-label="予定の表示"><button role="tab" aria-selected="${state.scheduleMode === "calendar"}" class="${state.scheduleMode === "calendar" ? "active" : ""}" data-action="mode-calendar">カレンダー</button><button role="tab" aria-selected="${state.scheduleMode === "todos"}" class="${state.scheduleMode === "todos" ? "active" : ""}" data-action="mode-todos">ToDo</button></div>
      ${state.scheduleMode === "calendar" ? renderCalendar() : renderTodoList()}
      <div class="schedule-actions"><button class="secondary-button" data-action="add-todo">${icon("plus", 18)} ToDo</button><button class="primary-button" data-action="add-event">${icon("plus", 18)} 予定を追加</button></div>
    </main>
  </div>`;
}

function renderFutureTab(kind) {
  const info = {
    money: { title: "お金", icon: "money", sub: "現金と毎月のお金を見える化", features: ["財布の現金残高", "家計簿の収支", "固定費・サブスク"] },
    work: { title: "仕事", icon: "work", sub: "シフトと給料見込みをまとめて管理", features: ["勤務先を登録", "シフトを登録", "勤務時間と給料見込み"] },
    life: { title: "生活", icon: "life", sub: "毎日の暮らしを整える", features: ["習慣・ルーティン", "持ち物・買い物", "ほしい物・メモ"] }
  }[kind];
  return `<div class="screen future-screen">
    ${header({ eyebrow: info.sub, title: info.title, actions: `<button class="icon-button" data-action="settings" aria-label="設定">${icon("settings", 21)}</button>` })}
    <main class="screen-content"><div class="future-hero"><span class="future-icon">${icon(info.icon, 38)}</span><span class="section-kicker green">COMING IN THE NEXT PHASE</span><h2>${info.title}の管理</h2><p>この機能は今後追加します。登録済みの情報をほかの機能にも活かせる形で準備しています。</p></div><div class="content-card"><div class="section-heading"><h2>追加予定の機能</h2></div>${info.features.map((feature) => `<div class="future-item"><span>${icon("check", 16)}</span>${escapeHTML(feature)}</div>`).join("")}</div></main>
  </div>`;
}

function renderSettings() {
  return `<div class="screen settings-screen">
    ${header({ title: "設定", back: true })}
    <main class="screen-content">
      <section class="content-card"><div class="section-heading"><div><span class="section-kicker green">YOUR DATA</span><h2>バックアップ</h2></div></div><p class="settings-copy">予定とToDoは、この端末のブラウザ内に保存されます。端末の変更やブラウザデータの削除に備えて、定期的にファイルを書き出してください。</p>
        <button class="settings-action" data-action="export">${icon("download", 20)}<span><strong>バックアップを書き出す</strong><small>JSONファイルとして保存</small></span>${icon("chevron", 17)}</button>
        <button class="settings-action" data-action="import">${icon("upload", 20)}<span><strong>バックアップを読み込む</strong><small>同じIDのデータはファイルの内容で更新</small></span>${icon("chevron", 17)}</button>
        <input id="backup-file" type="file" accept="application/json,.json" hidden />
      </section>
      <div class="privacy-note">${icon("wallet", 18)}<p>このアプリは現在、サーバーへ個人データを送信しません。バックアップの保管場所はご自身で選べます。</p></div>
      <p class="version-label">自分管理 · Phase 1</p>
    </main>
  </div>`;
}

function categoryOptions(selected) {
  return Object.entries(CATEGORIES).map(([value, category]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${escapeHTML(category.label)}</option>`).join("");
}

function renderEditor() {
  if (!state.editor) return "";
  const { kind, id } = state.editor;
  const item = id ? (kind === "event" ? state.events : state.todos).find((record) => record.id === id) : null;
  const isEvent = kind === "event";
  const day = item?.date || item?.dueDate || state.selectedDate || dateKey();
  const title = id ? (isEvent ? "予定を編集" : "ToDoを編集") : (isEvent ? "予定を追加" : "ToDoを追加");
  return `<div class="modal-backdrop" data-action="close-editor"><section class="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="editor-title">
    <div class="sheet-handle"></div><div class="editor-heading"><button class="text-link muted" type="button" data-action="close-editor">キャンセル</button><h2 id="editor-title">${title}</h2><span class="editor-heading-spacer"></span></div>
    <form id="editor-form" data-kind="${kind}" data-id="${escapeHTML(id || "")}">
      <label class="field"><span>タイトル</span><input name="title" maxlength="120" placeholder="${isEvent ? "予定の内容" : "やること"}" value="${escapeHTML(item?.title || "")}" required autofocus /></label>
      <label class="field"><span>${isEvent ? "日付" : "期限日"}</span><input name="date" type="date" value="${escapeHTML(day)}" ${isEvent ? "required" : ""} /></label>
      ${isEvent ? `<label class="toggle-field"><span>終日の予定</span><input name="allDay" type="checkbox" ${item?.allDay ? "checked" : ""} /></label><div class="time-fields"><label class="field"><span>開始</span><input name="start" type="time" value="${escapeHTML(item?.start || "09:00")}" /></label><label class="field"><span>終了</span><input name="end" type="time" value="${escapeHTML(item?.end || "10:00")}" /></label></div>` : `<label class="field"><span>期限時刻 <small>任意</small></span><input name="dueTime" type="time" value="${escapeHTML(item?.dueTime || "")}" /></label>`}
      <label class="field"><span>カテゴリ</span><select name="category">${categoryOptions(item?.category || (isEvent ? "private" : "life"))}</select></label>
      <label class="field"><span>メモ <small>任意</small></span><textarea name="note" rows="3" maxlength="2000" placeholder="補足があれば記入">${escapeHTML(item?.note || "")}</textarea></label>
      <p class="form-error" id="form-error" role="alert"></p>
      <button class="primary-button save-button" type="submit">${id ? "変更を保存" : "登録する"}</button>
      ${id ? `<button class="delete-button" type="button" data-action="delete-record" data-kind="${kind}" data-id="${escapeHTML(id)}">${icon("trash", 17)} 削除する</button>` : ""}
    </form>
  </section></div>`;
}

function renderNav() {
  return `<nav class="bottom-nav" aria-label="メインメニュー">${TABS.map((tab) => `<button class="nav-item ${state.tab === tab.id && !state.page ? "active" : ""}" data-action="tab" data-tab="${tab.id}" aria-current="${state.tab === tab.id && !state.page ? "page" : "false"}">${icon(tab.icon, 23)}<span>${tab.label}</span></button>`).join("")}</nav>`;
}

function render() {
  if (!state.db) return;
  const screen = state.page === "settings" ? renderSettings() : state.tab === "home" ? renderHome() : state.tab === "schedule" ? renderSchedule() : renderFutureTab(state.tab);
  root.innerHTML = `${screen}${renderNav()}${renderEditor()}`;
  document.title = `${state.page === "settings" ? "設定" : TABS.find((tab) => tab.id === state.tab)?.label} | 自分管理`;
  if (state.editor) root.querySelector("#editor-form [name=title]")?.focus();
}

function openEditor(kind, id = null) {
  state.editor = { kind, id };
  render();
}

function closeEditor() {
  state.editor = null;
  render();
}

function changeMonth(delta) {
  const date = new Date(state.year, state.month + delta, 1);
  state.year = date.getFullYear();
  state.month = date.getMonth();
  state.selectedDate = dateKey(date);
  render();
}

async function toggleTodo(id) {
  const todo = state.todos.find((record) => record.id === id);
  if (!todo) return;
  await putRecord(state.db, "todos", { ...todo, completedAt: todo.completedAt ? null : new Date().toISOString(), updatedAt: new Date().toISOString() });
  await refresh();
}

async function saveForm(form) {
  if (state.busy) return;
  const kind = form.dataset.kind;
  const existing = form.dataset.id ? (kind === "event" ? state.events : state.todos).find((item) => item.id === form.dataset.id) : null;
  const fields = new FormData(form);
  const now = new Date().toISOString();
  const common = { id: existing?.id || crypto.randomUUID(), title: String(fields.get("title") || "").trim(), category: String(fields.get("category") || "other"), note: String(fields.get("note") || "").trim(), createdAt: existing?.createdAt || now, updatedAt: now };
  const record = kind === "event"
    ? { ...common, date: String(fields.get("date") || ""), allDay: fields.has("allDay"), start: fields.has("allDay") ? "" : String(fields.get("start") || ""), end: fields.has("allDay") ? "" : String(fields.get("end") || "") }
    : { ...common, dueDate: String(fields.get("date") || ""), dueTime: String(fields.get("dueTime") || ""), completedAt: existing?.completedAt || null };
  const error = kind === "event" ? validateEvent(record) : validateTodo(record);
  if (error) {
    form.querySelector("#form-error").textContent = error;
    return;
  }
  state.busy = true;
  try {
    await putRecord(state.db, kind === "event" ? "events" : "todos", record);
    state.editor = null;
    await refresh();
    toast(existing ? "変更を保存しました。" : "登録しました。");
  } catch (cause) {
    form.querySelector("#form-error").textContent = `保存できませんでした。${cause?.message || ""}`;
  } finally {
    state.busy = false;
  }
}

async function deleteItem(kind, id) {
  const label = kind === "event" ? "予定" : "ToDo";
  if (!window.confirm(`この${label}を削除しますか？`)) return;
  await deleteRecord(state.db, kind === "event" ? "events" : "todos", id);
  state.editor = null;
  await refresh();
  toast("削除しました。");
}

async function downloadBackup() {
  const backup = await exportBackup(state.db);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `自分管理-backup-${dateKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast("バックアップを書き出しました。保存先を確認してください。");
}

async function loadBackup(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) throw new Error("ファイルが大きすぎます（上限10MB）。");
  const data = JSON.parse(await file.text());
  if (!window.confirm("バックアップを読み込みますか？同じIDの予定・ToDoはファイルの内容で更新されます。")) return;
  await importBackup(state.db, data);
  await refresh();
  toast("バックアップを読み込みました。");
}

root.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "close-editor" && event.target !== button && button.classList.contains("modal-backdrop")) return;
  try {
    if (action === "tab") { state.tab = button.dataset.tab; state.page = null; state.editor = null; render(); window.scrollTo(0, 0); }
    else if (action === "settings") { state.page = "settings"; render(); }
    else if (action === "close-page") { state.page = null; render(); }
    else if (action === "goto-schedule") { state.tab = "schedule"; state.scheduleMode = "calendar"; render(); }
    else if (action === "goto-todos") { state.tab = "schedule"; state.scheduleMode = "todos"; render(); }
    else if (action === "mode-calendar") { state.scheduleMode = "calendar"; render(); }
    else if (action === "mode-todos") { state.scheduleMode = "todos"; render(); }
    else if (action === "previous-month") changeMonth(-1);
    else if (action === "next-month") changeMonth(1);
    else if (action === "select-day") { state.selectedDate = button.dataset.date; render(); }
    else if (action === "today") { state.selectedDate = dateKey(); const now = new Date(); state.month = now.getMonth(); state.year = now.getFullYear(); render(); }
    else if (action === "add-event") openEditor("event");
    else if (action === "add-todo") openEditor("todo");
    else if (action === "edit-event") openEditor("event", button.dataset.id);
    else if (action === "edit-todo") openEditor("todo", button.dataset.id);
    else if (action === "toggle-todo") await toggleTodo(button.dataset.id);
    else if (action === "close-editor") closeEditor();
    else if (action === "delete-record") await deleteItem(button.dataset.kind, button.dataset.id);
    else if (action === "export") await downloadBackup();
    else if (action === "import") root.querySelector("#backup-file")?.click();
  } catch (cause) {
    toast(cause?.message || "操作を完了できませんでした。", true);
  }
});

root.addEventListener("submit", (event) => {
  if (event.target.id !== "editor-form") return;
  event.preventDefault();
  saveForm(event.target);
});

root.addEventListener("change", async (event) => {
  if (event.target.id !== "backup-file") return;
  try { await loadBackup(event.target.files?.[0]); }
  catch (cause) { toast(cause?.message || "バックアップを読み込めませんでした。", true); }
  event.target.value = "";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.editor) closeEditor();
});

window.addEventListener("pageshow", () => {
  if (state.db) refresh().catch((cause) => toast(cause.message, true));
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.db) refresh().catch((cause) => toast(cause.message, true));
});

async function start() {
  try {
    state.db = await openDatabase();
    await refresh();
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("./sw.js").catch(() => toast("オフライン利用の準備ができませんでした。", true));
    }
  } catch (cause) {
    root.innerHTML = `<main class="startup-error"><span>${icon("wallet", 36)}</span><h1>保存領域を開けませんでした</h1><p>${escapeHTML(cause?.message || "ブラウザの保存設定を確認してください。")}</p><button class="primary-button" onclick="location.reload()">再試行</button></main>`;
  }
}

start();
