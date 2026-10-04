import { addDays, CATEGORIES, dateKey, deleteRepeatingEventOccurrence, eventsForDay, formatDay, homeSummary, isValidDateKey, monthGrid, remindersForWindow, todoOccurrence, todosForDay, validateEvent, validateTodo } from "./domain.js?v=19";
import { deleteHabit, deleteRecord, exportBackup, getAll, importBackup, openDatabase, putRecord, putWishlistPurchase } from "./db.js?v=19";
import { icon } from "./icons.js?v=19";
import { cashBalance, fixedCostDueDate, fixedCostReminders, fixedCostsForDay, fixedCostSummary, monthSummary, validateFixedCost, validateTransaction, validateWallet } from "./money.js?v=19";
import { renderMoneyEditor, renderMoneyScreen, yen } from "./money-ui.js?v=19";
import { renderMoneyCategoryChoices } from "./money-entry-ui.js?v=19";
import { MONEY_CATEGORIES, MONEY_CATEGORY_COLORS, moneyCategoryCatalog, resolveMoneyCategories, validateMoneyCategory } from "./money-categories.js?v=19";
import { renderMoneyCategoryEditor } from "./money-categories-ui.js?v=19";
import { payPeriodForDate } from "./pay-cycle.js?v=19";
import { nextShift, shiftMinutes, shiftPay, shiftsForDay, validateWorkplace, validateWorkShift, workPeriod, workPeriodForDate } from "./work.js?v=19";
import { renderWorkEditor, renderWorkScreen } from "./work-ui.js?v=19";
import { habitDueOn, habitProgress, mergeChecklistItems, validateChecklist, validateHabit, validateMemo, validateShoppingItem, validateWishlistItem } from "./life.js?v=19";
import { renderLifeEditor, renderLifeScreen } from "./life-ui.js?v=19";

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
  wallets: [],
  transactions: [],
  fixedCosts: [],
  moneyCategories: [],
  workplaces: [],
  workShifts: [],
  habits: [],
  habitRecords: [],
  checklists: [],
  shoppingItems: [],
  wishlistItems: [],
  memos: [],
  lifeMode: "today",
  activeChecklistId: null,
  lifeEditor: null,
  workMode: "month",
  workMonth: dateKey().slice(0, 7),
  workMonthInitialized: false,
  workWorkplaceId: null,
  workSelectedDate: dateKey(),
  workEditor: null,
  moneyMode: "overview",
  moneySelectedDate: null,
  moneyMonth: dateKey().slice(0, 7),
  moneyMonthInitialized: false,
  moneyEditor: null,
  moneyCategoryEditor: null,
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
  [state.events, state.todos, state.wallets, state.transactions, state.fixedCosts, state.moneyCategories, state.workplaces, state.workShifts, state.habits, state.habitRecords, state.checklists, state.shoppingItems, state.wishlistItems, state.memos] = await Promise.all(["events", "todos", "wallets", "transactions", "fixedCosts", "moneyCategories", "workplaces", "workShifts", "habits", "habitRecords", "checklists", "shoppingItems", "wishlistItems", "memos"].map((store) => getAll(state.db, store)));
  if (!state.moneyMonthInitialized) { state.moneyMonth = payPeriodForDate(dateKey(), state.wallets.find((item) => item.id === "cash")); state.moneyMonthInitialized = true; }
  if (!state.workplaces.some((item) => item.id === state.workWorkplaceId)) state.workWorkplaceId = state.workplaces[0]?.id || null;
  if (!state.workMonthInitialized) { state.workMonth = workPeriodForDate(dateKey(), state.workplaces.find((item) => item.id === state.workWorkplaceId)); state.workMonthInitialized = true; }
  render();
}

function currentMoneyCategories() { return resolveMoneyCategories(state.moneyCategories, state.transactions, state.fixedCosts); }
function moneyData() { return { wallet: state.wallets.find((item) => item.id === "cash") || null, transactions: state.transactions, fixedCosts: state.fixedCosts, categories: currentMoneyCategories(), mode: state.moneyMode, month: state.moneyMonth, selectedDate: state.moneySelectedDate }; }
function workData() { return { workplaces: state.workplaces, shifts: state.workShifts, workplaceId: state.workWorkplaceId, mode: state.workMode, month: state.workMonth, selectedDate: state.workSelectedDate }; }
function lifeData() { return { habits: state.habits, habitRecords: state.habitRecords, checklists: state.checklists, shoppingItems: state.shoppingItems, wishlistItems: state.wishlistItems, memos: state.memos, moneyCategories: currentMoneyCategories(), mode: state.lifeMode, activeChecklistId: state.activeChecklistId }; }

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
  const upcomingShift = nextShift(state.workShifts);
  const dueHabits = state.habits.filter((habit) => habitDueOn(habit, today));
  const doneHabits = dueHabits.filter((habit) => habitProgress(habit, state.habitRecords, today).todayDone).length;
  return `<div class="screen home-screen">
    ${header({
      eyebrow: `${formatDay(today, { year: "numeric", month: "long", day: "numeric" })}（${weekdayLabel(today)}）`,
      title: "今日のまとめ",
      actions: `<button class="icon-button" data-action="reminders" aria-label="リマインダー">${icon("bell", 21)}</button><button class="icon-button" data-action="settings" aria-label="設定">${icon("settings", 21)}</button>`
    })}
    <main class="screen-content">
      <section class="day-brief" aria-label="今日の見通し"><div class="day-brief-date"><span>${Number(today.slice(5, 7))}月</span><strong>${Number(today.slice(-2))}</strong><span>${weekdayLabel(today)}曜日</span></div><div class="day-brief-body"><span>今日の見通し</span><strong>予定 ${summary.todayEvents.length}件 <i></i> やること ${summary.openCount}件</strong><small>${summary.openCount ? "残りのToDoを確認しましょう。" : summary.todayTodos.length ? "今日のToDoは完了しました。" : "予定やToDoをここで確認できます。"}</small></div></section>
      <section class="content-card dashboard-card dashboard-schedule">
        <div class="section-heading"><div class="dashboard-heading"><span class="section-symbol">${icon("calendar", 19)}</span><div><span class="section-kicker">予定</span><h2>今日の予定</h2></div></div><button class="text-link" data-action="goto-schedule">予定を見る ${icon("chevron", 14)}</button></div>
        ${summary.todayEvents.length ? summary.todayEvents.slice(0, 4).map(renderEventRow).join("") : `<div class="empty-inline"><span class="empty-icon blue">${icon("calendar", 22)}</span><p>今日の予定はありません</p></div>`}
        <button class="inline-add" data-action="add-event">${icon("plus", 17)} 予定を追加</button>
      </section>
      <section class="content-card dashboard-card dashboard-todo">
        <div class="section-heading"><div class="dashboard-heading"><span class="section-symbol">${icon("check", 19)}</span><div><span class="section-kicker">やること</span><h2>今日のToDo</h2></div></div><span class="section-count">${completedCount} / ${summary.todayTodos.length} 完了</span></div>
        ${summary.overdueTodos.length ? `<div class="overdue-note">期限を過ぎたToDoが ${summary.overdueTodos.length} 件あります</div>${summary.overdueTodos.slice(0, 2).map((todo) => renderTodoRow(todo, true)).join("")}` : ""}
        ${summary.todayTodos.length ? summary.todayTodos.slice(0, 5).map((todo) => renderTodoRow(todo, false)).join("") : `<div class="empty-inline"><span class="empty-icon pink">${icon("check", 22)}</span><p>今日のToDoはありません</p></div>`}
        <button class="inline-add" data-action="add-todo">${icon("plus", 17)} ToDoを追加</button>
      </section>
      <section class="content-card dashboard-card dashboard-work"><div class="section-heading"><div class="dashboard-heading"><span class="section-symbol">${icon("work", 19)}</span><div><span class="section-kicker">仕事</span><h2>次の仕事</h2></div></div><button class="text-link" data-action="goto-work">シフトを見る ${icon("chevron", 14)}</button></div>${upcomingShift ? renderShiftAgendaRow(upcomingShift) : '<div class="empty-inline"><span class="empty-icon">' + icon("work", 22) + '</span><p>今後のシフトはありません</p></div>'}</section>
      <section class="content-card dashboard-card dashboard-money"><div class="section-heading"><div class="dashboard-heading"><span class="section-symbol">${icon("money", 19)}</span><div><span class="section-kicker">お金</span><h2>現金の財布</h2></div></div><button class="text-link" data-action="goto-money">詳しく見る ${icon("chevron", 14)}</button></div><div class="money-summary"><div><span>財布の現金</span><b>${yen(cashBalance(moneyData().wallet, state.transactions))}</b></div><div><span>今月の現金支出</span><b class="expense">${yen(monthSummary(state.transactions.filter((item) => item.paymentMethod === "cash"), today.slice(0, 7)).expense)}</b></div></div><p class="field-help">固定費・サブスクは財布とは別に管理します。</p></section>
      <section class="content-card dashboard-card dashboard-life"><div class="section-heading"><div class="dashboard-heading"><span class="section-symbol">${icon("life", 19)}</span><div><span class="section-kicker">生活</span><h2>今日の習慣</h2></div></div><button class="text-link" data-action="goto-life">生活を見る ${icon("chevron", 14)}</button></div><div class="life-home-summary"><strong>${doneHabits}/${dueHabits.length}</strong><span>今日の習慣を達成</span></div>${dueHabits.length ? dueHabits.slice(0, 3).map((habit) => `<div class="life-home-item">${habitProgress(habit, state.habitRecords, today).todayDone ? "✓" : "○"} ${escapeHTML(habit.title)}</div>`).join("") : '<p class="life-note">習慣を登録すると、ここでも確認できます。</p>'}</section>
    </main>
  </div>`;
}

function renderEventRow(event) {
  const category = CATEGORIES[event.category] || CATEGORIES.other;
  return `<button class="event-row" data-action="edit-event" data-id="${escapeHTML(event.id)}" data-date="${escapeHTML(event.occurrenceDate || event.date)}">
    <span class="event-stripe" style="--stripe:${category.color}"></span>
    <span class="event-details"><strong>${escapeHTML(event.title)}</strong><span>${escapeHTML(clockRange(event))} <span class="middot">·</span> ${escapeHTML(category.label)}</span></span>
    ${icon("chevron", 16)}
  </button>`;
}

function renderShiftAgendaRow(shift) {
  const workplace = state.workplaces.find((item) => item.id === shift.workplaceId);
  if (!workplace) return "";
  return `<button class="event-row" data-action="work-edit-shift" data-id="${escapeHTML(shift.id)}"><span class="event-stripe" style="--stripe:#f28b54"></span><span class="event-details"><strong>${escapeHTML(workplace.name)}</strong><span>${escapeHTML(displayDate(shift.date))} · ${escapeHTML(shift.start)}〜${escapeHTML(shift.end)} · ${Math.round(shiftMinutes(shift) / 6) / 10}時間 · ${workplace.transportPerDay ? "時給分" : "見込み"} ${yen(shiftPay(shift, workplace))}</span></span>${icon("chevron", 16)}</button>`;
}

function renderTodoRow(todo, overdue=false) {
  const category=CATEGORIES[todo.category]||CATEGORIES.other;
  const due=todo.occurrenceDate||todo.dueDate||"";
  return `<div class="todo-row ${todo.completedAt?"done":""}"><button class="todo-check ${todo.completedAt?"checked":""}" data-action="toggle-todo" data-id="${escapeHTML(todo.id)}" data-date="${escapeHTML(due)}" aria-label="${todo.completedAt?"未完了に戻す":"完了にする"}: ${escapeHTML(todo.title)}">${todo.completedAt?icon("check",15):""}</button><button class="todo-details" data-action="edit-todo" data-id="${escapeHTML(todo.id)}"><strong>${escapeHTML(todo.title)}</strong><span>${overdue?`期限 ${escapeHTML(displayDate(due))} · `:todo.dueTime?`${escapeHTML(todo.dueTime)} · `:""}${escapeHTML(category.label)}${todo.repeatRule&&todo.repeatRule!=="none"?" · 繰り返し":""}</span></button>${overdue?`<span class="overdue-tag">期限超過</span>`:""}</div>`;
}

function renderDayAgenda(key) {
  const events=eventsForDay(state.events,key),todos=todosForDay(state.todos,key),fixed=fixedCostsForDay(state.fixedCosts,key),shifts=shiftsForDay(state.workShifts,key);
  return `<div class="day-agenda"><div class="section-heading"><div><span class="section-kicker green">AGENDA</span><h2>${escapeHTML(displayDate(key))}</h2></div><button class="small-today" data-action="today">今日</button></div>${events.length||todos.length||fixed.length||shifts.length?events.map(renderEventRow).join("")+shifts.map(renderShiftAgendaRow).join("")+todos.map((todo)=>renderTodoRow(todo)).join("")+fixed.map((item)=>`<button class="event-row" data-action="money-edit-fixed" data-id="${escapeHTML(item.id)}"><span class="event-stripe" style="--stripe:#f28b54"></span><span class="event-details"><strong>${escapeHTML(item.title)} · ${yen(item.amount)}</strong><span>固定費 ${item.paid?"· 支払い済み":""}</span></span>${icon("chevron",16)}</button>`).join(""):`<div class="empty-inline"><p>この日の予定・ToDo・シフトはありません</p></div>`}</div>`;
}

function renderCalendar() {
  const today=dateKey(),cells=monthGrid(state.year,state.month);
  return `<div class="calendar-panel"><div class="month-control"><button class="icon-button" data-action="previous-month" aria-label="前月">${icon("arrowLeft",20)}</button><h2>${state.year}年${state.month+1}月</h2><button class="icon-button" data-action="next-month" aria-label="翌月">${icon("chevron",20)}</button></div><div class="weekdays"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div><div class="calendar-grid">${cells.map((key)=>{const colors=eventsForDay(state.events,key).map((event)=>CATEGORIES[event.category]?.color||"#9b9eaa");colors.push(...shiftsForDay(state.workShifts,key).map(() => "#f28b54"));colors.push(...todosForDay(state.todos,key).map((todo)=>todo.completedAt?"#bfc8c4":"#e76995"));colors.push(...fixedCostsForDay(state.fixedCosts,key).map(() => "#f28b54"));return `<button class="day-cell ${Number(key.slice(5,7))===state.month+1?"":"outside"} ${key===today?"today":""} ${key===state.selectedDate?"selected":""}" data-action="select-day" data-date="${key}" aria-label="${escapeHTML(displayDate(key))}"><span>${Number(key.slice(-2))}</span><span class="day-dots">${colors.slice(0,3).map((color)=>`<i style="background:${color}"></i>`).join("")}</span></button>`}).join("")}</div>${renderDayAgenda(state.selectedDate)}</div>`;
}

function weekStart(key) {
  const [y,m,d]=key.split("-").map(Number);
  return addDays(key,-new Date(y,m-1,d).getDay());
}

function renderWeek() {
  const first=weekStart(state.selectedDate),days=Array.from({length:7},(_,i)=>addDays(first,i));
  return `<div class="calendar-panel"><div class="month-control"><button class="icon-button" data-action="previous-period" aria-label="前週">${icon("arrowLeft",20)}</button><h2>${escapeHTML(displayDate(first))} 〜 ${escapeHTML(displayDate(days[6]))}</h2><button class="icon-button" data-action="next-period" aria-label="翌週">${icon("chevron",20)}</button></div><div class="week-strip">${days.map((key)=>`<button class="week-day ${key===state.selectedDate?"selected":""}" data-action="select-day" data-date="${key}"><span>${escapeHTML(weekdayLabel(key))}</span><strong>${Number(key.slice(-2))}</strong><small>${eventsForDay(state.events,key).length+todosForDay(state.todos,key).length+fixedCostsForDay(state.fixedCosts,key).length+shiftsForDay(state.workShifts,key).length||""}</small></button>`).join("")}</div>${renderDayAgenda(state.selectedDate)}</div>`;
}

function renderDay() {
  return `<div class="calendar-panel"><div class="month-control"><button class="icon-button" data-action="previous-period" aria-label="前日">${icon("arrowLeft",20)}</button><h2>${escapeHTML(displayDate(state.selectedDate))}</h2><button class="icon-button" data-action="next-period" aria-label="翌日">${icon("chevron",20)}</button></div>${renderDayAgenda(state.selectedDate)}</div>`;
}

function renderEventList() {
  const days=Array.from({length:30},(_,i)=>addDays(state.selectedDate,i));
  const active=days.filter((key)=>eventsForDay(state.events,key).length||todosForDay(state.todos,key).length||fixedCostsForDay(state.fixedCosts,key).length||shiftsForDay(state.workShifts,key).length);
  return `<div class="calendar-panel"><div class="month-control"><button class="icon-button" data-action="previous-period" aria-label="前の30日">${icon("arrowLeft",20)}</button><h2>${escapeHTML(displayDate(state.selectedDate))}から30日</h2><button class="icon-button" data-action="next-period" aria-label="次の30日">${icon("chevron",20)}</button></div>${active.length?active.map(renderDayAgenda).join(""):`<div class="empty-large"><strong>この期間の予定はありません</strong></div>`}</div>`;
}

function listTodo(todo,today) {
  if (!todo.dueDate||!todo.repeatRule||todo.repeatRule==="none") return todo;
  let key=todo.dueDate>today?todo.dueDate:today;
  for(let i=0;i<370;i++,key=addDays(key,1)){
    if(todo.repeatUntil&&key>todo.repeatUntil)break;
    const occurrence=todoOccurrence(todo,key);
    if(occurrence&&!occurrence.completedAt)return occurrence;
  }
  return {...todo,occurrenceDate:todo.repeatUntil||todo.dueDate,completedAt:"done"};
}

function renderTodoList() {
  const today=dateKey();
  const sorted=state.todos.map((todo)=>listTodo(todo,today)).sort((a,b)=>Number(Boolean(a.completedAt))-Number(Boolean(b.completedAt))||(a.occurrenceDate||a.dueDate||"9999").localeCompare(b.occurrenceDate||b.dueDate||"9999"));
  const open=sorted.filter((todo)=>!todo.completedAt),done=sorted.filter((todo)=>todo.completedAt);
  const row=(todo)=>`<div class="todo-list-item">${renderTodoRow(todo)}<p class="todo-due">${todo.dueDate?`${todo.repeatRule&&todo.repeatRule!=="none"?"次回":todo.dueDate<today&&!todo.completedAt?"期限超過":"期限"} · ${escapeHTML(displayDate(todo.occurrenceDate||todo.dueDate))}`:"期限なし"}</p></div>`;
  return `<div class="todo-list-panel"><div class="section-heading"><div><span class="section-kicker green">YOUR TASKS</span><h2>やること一覧</h2></div><span class="section-count">未完了 ${open.length} 件</span></div>${open.length?open.map(row).join(""):`<div class="empty-large"><strong>未完了のToDoはありません</strong></div>`}${done.length?`<div class="completed-heading">完了済み <span>${done.length}</span></div>${done.map(row).join("")}`:""}</div>`;
}

function renderSchedule() {
  const modes=[["calendar","月"],["week","週"],["day","日"],["list","一覧"],["todos","ToDo"]];
  return `<div class="screen schedule-screen">${header({eyebrow:"予定とやることをひとつに",title:"予定",actions:`<button class="icon-button" data-action="reminders" aria-label="リマインダー">${icon("bell",21)}</button><button class="icon-button" data-action="settings" aria-label="設定">${icon("settings",21)}</button>`})}<main class="screen-content"><div class="segmented schedule-modes" role="tablist" aria-label="予定の表示">${modes.map(([mode,label])=>`<button role="tab" aria-selected="${state.scheduleMode===mode}" class="${state.scheduleMode===mode?"active":""}" data-action="mode" data-mode="${mode}">${label}</button>`).join("")}</div>${state.scheduleMode==="calendar"?renderCalendar():state.scheduleMode==="week"?renderWeek():state.scheduleMode==="day"?renderDay():state.scheduleMode==="list"?renderEventList():renderTodoList()}<div class="schedule-actions"><button class="secondary-button" data-action="add-todo">${icon("plus",18)} ToDo</button><button class="primary-button" data-action="add-event">${icon("plus",18)} 予定を追加</button></div></main></div>`;
}

function renderReminders() {
  const now=new Date(),items=[...remindersForWindow(state.events,state.todos,now),...fixedCostReminders(state.fixedCosts,now)].sort((a,b)=>a.triggerAt-b.triggerAt);
  const due=items.filter((item)=>item.triggerAt<=now),upcoming=items.filter((item)=>item.triggerAt>now);
  const row=(item)=>`<button class="reminder-row" data-action="${item.kind==="fixedCost"?"money-edit-fixed":`edit-${item.kind}`}" data-id="${escapeHTML(item.id)}" data-date="${escapeHTML(item.occurrenceDate)}"><span class="reminder-icon">${icon(item.kind==="event"?"calendar":item.kind==="fixedCost"?"money":"check",18)}</span><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(displayDate(item.occurrenceDate))} ${item.scheduledAt.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})} · ${item.kind==="event"?"予定":item.kind==="fixedCost"?"固定費":"ToDo"}</small></span><em class="${item.triggerAt<=now?"due":""}">${item.triggerAt<=now?"確認":"予定"}</em></button>`;
  return `<div class="screen reminders-screen">${header({title:"リマインダー",back:true})}<main class="screen-content"><div class="privacy-note">${icon("bell",18)}<p>アプリを開いているときに確認できます。指定時刻のバックグラウンド通知はまだ利用できません。</p></div><section class="content-card"><div class="section-heading"><h2>確認する項目</h2><span class="section-count">${due.length}件</span></div>${due.length?due.map(row).join(""):`<div class="empty-inline"><p>確認する項目はありません</p></div>`}</section><section class="content-card"><div class="section-heading"><h2>これから7日間</h2><span class="section-count">${upcoming.length}件</span></div>${upcoming.length?upcoming.map(row).join(""):`<div class="empty-inline"><p>予定されているリマインダーはありません</p></div>`}</section></main></div>`;
}

function renderSettings() {
  return `<div class="screen settings-screen">
    ${header({ title: "設定", back: true })}
    <main class="screen-content">
      <section class="content-card"><div class="section-heading"><div><span class="section-kicker green">YOUR DATA</span><h2>バックアップ</h2></div></div><p class="settings-copy">予定・ToDo・お金・仕事・生活の記録は、この端末のブラウザ内に保存されます。端末の変更やブラウザデータの削除に備えて、定期的にファイルを書き出してください。</p>
        <button class="settings-action" data-action="export">${icon("download", 20)}<span><strong>バックアップを書き出す</strong><small>JSONファイルとして保存</small></span>${icon("chevron", 17)}</button>
        <button class="settings-action" data-action="import">${icon("upload", 20)}<span><strong>バックアップを読み込む</strong><small>同じIDのデータはファイルの内容で更新</small></span>${icon("chevron", 17)}</button>
        <input id="backup-file" type="file" accept="application/json,.json" hidden />
      </section>
      <div class="privacy-note">${icon("wallet", 18)}<p>このアプリは現在、サーバーへ個人データを送信しません。バックアップの保管場所はご自身で選べます。</p></div>
      <p class="version-label">自分管理 · Phase 5</p>
    </main>
  </div>`;
}

function categoryOptions(selected) {
  return Object.entries(CATEGORIES).map(([value, category]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${escapeHTML(category.label)}</option>`).join("");
}

function renderEditor() {
  if (!state.editor) return "";
  const { kind, id } = state.editor;
  const item = id ? (kind === "event" ? state.events : state.todos).find((record) => record.id === id) : state.editor.draft;
  const isEvent = kind === "event";
  const repeatingEvent = isEvent && item?.repeatRule && item.repeatRule !== "none";
  const occurrenceDate = state.editor.occurrenceDate || item?.date;
  if (state.editor.deleteScope && repeatingEvent) return `<div class="modal-backdrop" data-action="close-editor"><section class="editor-sheet delete-scope-sheet" role="dialog" aria-modal="true" aria-labelledby="delete-scope-title"><div class="sheet-handle"></div><div class="editor-heading"><h2 id="delete-scope-title">繰り返し予定を削除</h2></div><p class="delete-scope-target">${escapeHTML(displayDate(occurrenceDate))}の「${escapeHTML(item.title)}」</p><button class="delete-scope-option" data-action="delete-repeating-event" data-scope="single"><strong>この予定だけ削除</strong><small>ほかの日の繰り返しは残します</small></button><button class="delete-scope-option" data-action="delete-repeating-event" data-scope="future"><strong>この予定以降を削除</strong><small>選んだ日より前の予定は残します</small></button><button class="secondary-button delete-scope-cancel" data-action="cancel-event-delete">戻る</button></section></div>`;
  const day = item?.date || item?.dueDate || state.selectedDate || dateKey();
  const title = id ? (isEvent ? "予定を編集" : "ToDoを編集") : (isEvent ? "予定を追加" : "ToDoを追加");
  return `<div class="modal-backdrop" data-action="close-editor"><section class="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="editor-title">
    <div class="sheet-handle"></div><div class="editor-heading"><button class="text-link muted" type="button" data-action="close-editor">キャンセル</button><h2 id="editor-title">${title}</h2><span class="editor-heading-spacer"></span></div>
    <form id="editor-form" data-kind="${kind}" data-id="${escapeHTML(id || "")}">
      ${id && repeatingEvent ? `<p class="field-help">${escapeHTML(displayDate(occurrenceDate))}の予定を選択中。編集内容は繰り返し全体に適用されます。</p>` : ""}
      <label class="field"><span>タイトル</span><input name="title" maxlength="120" placeholder="${isEvent ? "予定の内容" : "やること"}" value="${escapeHTML(item?.title || "")}" required /></label>
      <label class="field"><span>${isEvent ? "日付" : "期限日"}</span><input name="date" type="date" value="${escapeHTML(day)}" ${isEvent ? "required" : ""} /></label>
      ${isEvent ? `<label class="toggle-field"><span>終日の予定</span><input name="allDay" type="checkbox" ${item?.allDay ? "checked" : ""} /></label><div class="time-fields"><label class="field"><span>開始</span><input name="start" type="time" value="${escapeHTML(item?.start || "09:00")}" /></label><label class="field"><span>終了</span><input name="end" type="time" value="${escapeHTML(item?.end || "10:00")}" /></label></div>` : `<label class="field"><span>期限時刻 <small>任意</small></span><input name="dueTime" type="time" value="${escapeHTML(item?.dueTime || "")}" /></label>`}
      <label class="field"><span>繰り返し</span><select name="repeatRule"><option value="none" ${!item?.repeatRule || item.repeatRule === "none" ? "selected" : ""}>なし</option><option value="daily" ${item?.repeatRule === "daily" ? "selected" : ""}>毎日</option><option value="weekly" ${item?.repeatRule === "weekly" ? "selected" : ""}>毎週</option><option value="monthly" ${item?.repeatRule === "monthly" ? "selected" : ""}>毎月</option></select></label>
      <label class="field"><span>繰り返し終了日 <small>任意</small></span><input name="repeatUntil" type="date" value="${escapeHTML(item?.repeatUntil || "")}" /></label>
      <label class="field"><span>リマインダー</span><select name="reminderLead"><option value="none" ${!item?.reminderLead || item.reminderLead === "none" ? "selected" : ""}>なし</option><option value="at" ${item?.reminderLead === "at" ? "selected" : ""}>時刻になったら</option><option value="oneHour" ${item?.reminderLead === "oneHour" ? "selected" : ""}>1時間前</option><option value="oneDay" ${item?.reminderLead === "oneDay" ? "selected" : ""}>1日前</option></select></label>
      <p class="field-help">アプリ内で確認できます。終日・時刻なしは9:00が基準です。</p>
      <label class="field"><span>カテゴリ</span><select name="category">${categoryOptions(item?.category || (isEvent ? "private" : "life"))}</select></label>
      <label class="field"><span>メモ <small>任意</small></span><textarea name="note" rows="3" maxlength="2000" placeholder="補足があれば記入">${escapeHTML(item?.note || "")}</textarea></label>
      <p class="form-error" id="form-error" role="alert"></p>
      <button class="primary-button save-button" type="submit">${id ? "変更を保存" : "登録する"}</button>
      ${id ? `<button class="delete-button" type="button" data-action="${repeatingEvent ? "choose-event-delete" : "delete-record"}" data-kind="${kind}" data-id="${escapeHTML(id)}">${icon("trash", 17)} ${repeatingEvent ? "削除方法を選ぶ" : "削除する"}</button>` : ""}
    </form>
  </section></div>`;
}

function renderNav() {
  return `<nav class="bottom-nav" aria-label="メインメニュー">${TABS.map((tab) => `<button class="nav-item ${state.tab === tab.id && !state.page ? "active" : ""}" data-action="tab" data-tab="${tab.id}" aria-current="${state.tab === tab.id && !state.page ? "page" : "false"}">${icon(tab.icon, 23)}<span>${tab.label}</span></button>`).join("")}</nav>`;
}

function render() {
  if (!state.db) return;
  const screen = state.page === "settings" ? renderSettings() : state.page === "reminders" ? renderReminders() : state.tab === "home" ? renderHome() : state.tab === "schedule" ? renderSchedule() : state.tab === "money" ? renderMoneyScreen(moneyData()) : state.tab === "work" ? renderWorkScreen(workData()) : renderLifeScreen(lifeData());
  root.innerHTML = `${screen}${renderNav()}${renderEditor()}${renderMoneyEditor(state.moneyEditor, moneyData())}${renderMoneyCategoryEditor(state.moneyCategoryEditor, moneyData())}${renderWorkEditor(state.workEditor, workData())}${renderLifeEditor(state.lifeEditor, lifeData())}`;
  document.title = `${state.page === "settings" ? "設定" : state.page === "reminders" ? "リマインダー" : TABS.find((tab) => tab.id === state.tab)?.label} | 自分管理`;
}

function openEditor(kind, id = null, occurrenceDate = null) {
  state.editor = { kind, id, occurrenceDate };
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

async function toggleTodo(id, occurrenceDate) {
  const todo=state.todos.find((record)=>record.id===id);
  if(!todo)return;
  const now=new Date().toISOString();
  let updated;
  if(todo.repeatRule&&todo.repeatRule!=="none"){
    if(!occurrenceDate||!todoOccurrence(todo,occurrenceDate))return;
    const dates=new Set(todo.completedDates||[]);
    if(dates.has(occurrenceDate))dates.delete(occurrenceDate);else dates.add(occurrenceDate);
    updated={...todo,completedDates:[...dates].sort(),updatedAt:now};
  }else updated={...todo,completedAt:todo.completedAt?null:now,updatedAt:now};
  return putRecord(state.db,"todos",updated).then(refresh);
}

async function saveForm(form) {
  if (state.busy) return;
  const kind = form.dataset.kind;
  const existing = form.dataset.id ? (kind === "event" ? state.events : state.todos).find((item) => item.id === form.dataset.id) : null;
  const fields = new FormData(form);
  const now = new Date().toISOString();
  const repeatRule = String(fields.get("repeatRule") || "none");
  const anchor = String(fields.get("date") || "");
  const sameSeries = existing && existing.repeatRule === repeatRule && (existing.date || existing.dueDate) === anchor;
  const common = { repeatRule, repeatUntil: String(fields.get("repeatUntil") || ""), reminderLead: String(fields.get("reminderLead") || "none"), id: existing?.id || crypto.randomUUID(), title: String(fields.get("title") || "").trim(), category: String(fields.get("category") || "other"), note: String(fields.get("note") || "").trim(), sourceMemoId: existing?.sourceMemoId || state.editor?.draft?.sourceMemoId || null, createdAt: existing?.createdAt || now, updatedAt: now };
  const record = kind === "event"
    ? { ...common, date: String(fields.get("date") || ""), allDay: fields.has("allDay"), start: fields.has("allDay") ? "" : String(fields.get("start") || ""), end: fields.has("allDay") ? "" : String(fields.get("end") || ""), excludedDates: sameSeries && repeatRule !== "none" ? (existing.excludedDates || []).filter((date) => !common.repeatUntil || date <= common.repeatUntil) : [] }
    : { ...common, dueDate: String(fields.get("date") || ""), dueTime: String(fields.get("dueTime") || ""), completedAt: repeatRule === "none" ? (existing?.completedAt || null) : null, completedDates: sameSeries ? (existing?.completedDates || []) : [] };
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

async function deleteRepeatingEvent(scope) {
  if (state.busy || state.editor?.kind !== "event") return;
  const item = state.events.find((record) => record.id === state.editor.id);
  const key = state.editor.occurrenceDate || item?.date;
  const updated = deleteRepeatingEventOccurrence(item, key, scope);
  state.busy = true;
  try {
    if (updated) await putRecord(state.db, "events", { ...updated, updatedAt: new Date().toISOString() });
    else await deleteRecord(state.db, "events", item.id);
    state.editor = null;
    await refresh();
    toast(scope === "single" ? "この予定だけ削除しました。" : "この予定以降を削除しました。");
  } finally {
    state.busy = false;
  }
}

function shiftMoneyMonth(delta){
  const [year,month]=state.moneyMonth.split("-").map(Number);
  state.moneyMonth=dateKey(new Date(year,month-1+delta,1)).slice(0,7);
  state.moneySelectedDate=null;
  render();
}

function openMoneyEditor(kind,id=null,type="expense"){
  state.moneyEditor={kind,id,type,cashOnly:kind==="transaction"&&["overview","wallet"].includes(state.moneyMode)};render();
}

function closeMoneyEditor(){
  state.moneyEditor=null;render();
}

function openMoneyCategoryEditor(id=null,kind="expense"){
  state.moneyCategoryEditor={id,kind};render();
}

function updateMoneyEntryButton(form){
  const button=form.querySelector(".money-entry-submit");
  if(button)button.disabled=!(Number(form.elements.namedItem("amount")?.value)>0&&form.querySelector('input[name="category"]:checked'));
}

function updateMoneyCategoryButton(form){
  const button=form.querySelector('.save-button');
  const name=form.elements.namedItem("label");
  if(button&&name)button.disabled=!name.value.trim();
  const preview=form.querySelector(".money-category-preview");
  if(!preview)return;
  const selectedIcon=form.querySelector('input[name="icon"]:checked')?.value;
  const selectedColor=form.querySelector('input[name="color"]:checked')?.value;
  const label=preview.querySelector(".money-category-preview-label");
  if(label&&name)label.textContent=name.value.trim()||"新しいカテゴリ";
  if(selectedIcon)preview.querySelector(".money-category-preview-icon").innerHTML=icon(selectedIcon,31);
  if(MONEY_CATEGORY_COLORS.includes(selectedColor))preview.style.setProperty("--preview-color",selectedColor);
  const kind=form.elements.namedItem("kind")?.value;
  if(kind)preview.querySelector(".money-category-preview-kind").textContent=kind==="income"?"収入のカテゴリ":"支出のカテゴリ";
}

async function saveMoneyCategoryForm(form){
  if(state.busy)return;
  const id=form.dataset.id,existing=state.moneyCategories.find((item)=>item.id===id);
  const builtin=Boolean(id&&Object.hasOwn(MONEY_CATEGORIES,id));
  const fields=new FormData(form),now=new Date().toISOString();
  const record={id:id||`custom-${crypto.randomUUID()}`,label:builtin?MONEY_CATEGORIES[id]:String(fields.get("label")||"").trim(),icon:String(fields.get("icon")||""),color:String(fields.get("color")||""),kind:builtin?moneyCategoryCatalog(currentMoneyCategories()).find((item)=>item.id===id)?.kind:String(fields.get("kind")||""),createdAt:existing?.createdAt||now,updatedAt:now};
  const error=validateMoneyCategory(record);
  const duplicate=moneyCategoryCatalog(currentMoneyCategories(),record.kind).some((item)=>item.id!==record.id&&item.label===record.label);
  if(error||duplicate){form.querySelector("#money-category-error").textContent=error||(duplicate?"同じ名前のカテゴリがあります。":"");return;}
  state.busy=true;
  try{
    await putRecord(state.db,"moneyCategories",record);
    if(!id&&state.moneyEditor?.draft&&state.moneyEditor.draft.type===record.kind)state.moneyEditor.draft.category=record.id;
    state.moneyCategoryEditor=null;
    await refresh();
    toast(id?"カテゴリを更新しました。":"カテゴリを追加しました。");
  }catch(cause){form.querySelector("#money-category-error").textContent=`保存できませんでした。${cause?.message||""}`;}
  finally{state.busy=false;}
}

async function deleteMoneyCategory(id){
  if(!id?.startsWith("custom-")||!state.moneyCategories.some((item)=>item.id===id))return;
  if(state.transactions.some((item)=>item.category===id)||state.fixedCosts.some((item)=>item.category===id)){
    toast("このカテゴリを使っている記録があります。先に記録のカテゴリを変更してください。",true);return;
  }
  if(!window.confirm("このカテゴリを削除しますか？"))return;
  await deleteRecord(state.db,"moneyCategories",id);
  state.moneyCategoryEditor=null;
  await refresh();
  toast("カテゴリを削除しました。");
}

async function toggleFixedPaid(id,date){
  const item=state.fixedCosts.find((record)=>record.id===id);
  if(!item||fixedCostDueDate(item,date.slice(0,7))!==date)return;
  const dates=new Set(item.paidDates||[]);
  if(dates.has(date))dates.delete(date);else dates.add(date);
  await putRecord(state.db,"fixedCosts",{...item,paidDates:[...dates].sort(),updatedAt:new Date().toISOString()});
  await refresh();
}

async function saveMoneyForm(form){
  if(state.busy)return;
  const {kind,id}=form.dataset,fields=new FormData(form),now=new Date().toISOString();
  const existing=(kind==="wallet"||kind==="payday")?moneyData().wallet:id?(kind==="transaction"?state.transactions:state.fixedCosts).find((item)=>item.id===id):null;
  const common={id:(kind==="wallet"||kind==="payday")?"cash":existing?.id||crypto.randomUUID(),createdAt:existing?.createdAt||now,updatedAt:now};
  let record,store,error;
  if(kind==="wallet"){
    record={...existing,...common,openingBalance:Number(fields.get("openingBalance"))};
    store="wallets";error=validateWallet(record);
  }else if(kind==="payday"){
    const raw=String(fields.get("salaryDay")||"").trim();
    record={...existing,...common,openingBalance:existing?.openingBalance??0,salaryDay:raw?Number(raw):null,holidayShift:String(fields.get("holidayShift")||"previous")};
    store="wallets";error=validateWallet(record);
  }else if(kind==="transaction"){
    record={...common,type:String(fields.get("type")||""),amount:Number(fields.get("amount")),date:String(fields.get("date")||""),category:String(fields.get("category")||""),paymentMethod:String(fields.get("paymentMethod")||""),note:String(fields.get("note")||"").trim()};
    store="transactions";error=validateTransaction(record,state.moneyCategories);
  }else if(kind==="fixed"){
    const cadence=String(fields.get("cadence")||""),paymentDay=Number(fields.get("paymentDay")),startDate=String(fields.get("startDate")||"");
    const sameSchedule=existing?.cadence===cadence&&existing?.paymentDay===paymentDay&&existing?.startDate===startDate;
    record={...common,title:String(fields.get("title")||"").trim(),amount:Number(fields.get("amount")),category:String(fields.get("category")||""),cadence,paymentDay,startDate,endDate:String(fields.get("endDate")||""),reminderLead:String(fields.get("reminderLead")||"none"),note:String(fields.get("note")||"").trim(),paidDates:sameSchedule?(existing?.paidDates||[]):[]};
    store="fixedCosts";error=validateFixedCost(record,state.moneyCategories);
  }else return;
  if(error){form.querySelector("#money-form-error").textContent=error;return}
  state.busy=true;
  try{
    await putRecord(state.db,store,record);
    if(kind==="payday"){state.moneyMonth=payPeriodForDate(dateKey(),record);state.moneySelectedDate=null;}
    state.moneyEditor=null;
    await refresh();
    toast(existing?"変更を保存しました。":"登録しました。");
  }catch(cause){form.querySelector("#money-form-error").textContent=`保存できませんでした。${cause?.message||""}`;}
  finally{state.busy=false;}
}

async function deleteMoneyItem(kind,id){
  const store=kind==="transaction"?"transactions":kind==="fixed"?"fixedCosts":null;
  if(!store||!window.confirm("この記録を削除しますか？"))return;
  await deleteRecord(state.db,store,id);
  state.moneyEditor=null;
  await refresh();
  toast("削除しました。");
}

function shiftWorkMonth(delta) {
  const [year, month] = state.workMonth.split("-").map(Number);
  state.workMonth = dateKey(new Date(year, month - 1 + delta, 1)).slice(0, 7);
  state.workSelectedDate = workPeriod(state.workMonth, state.workplaces.find((item) => item.id === state.workWorkplaceId)).start;
  render();
}

function openWorkEditor(kind, id = null, lockDate = false) {
  if (kind === "shift" && !state.workplaces.length) {
    state.tab = "work";
    state.workMode = "workplaces";
    render();
    toast("先に勤務先を登録してください。");
    return;
  }
  state.workEditor = { kind, id, lockDate };
  render();
}

async function saveWorkForm(form) {
  if (state.busy) return;
  const { kind, id } = form.dataset;
  const existing = id ? (kind === "workplace" ? state.workplaces : state.workShifts).find((item) => item.id === id) : null;
  const fields = new FormData(form);
  const now = new Date().toISOString();
  const common = { id: existing?.id || crypto.randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now };
  const record = kind === "workplace"
    ? { ...common, name: String(fields.get("name") || "").trim(), hourlyWage: Number(fields.get("hourlyWage")), transportPerDay: fields.get("transportPerDay") ? Number(fields.get("transportPerDay")) : 0, closingDay: Number(fields.get("closingDay")), payday: fields.get("payday") ? Number(fields.get("payday")) : null, payMonthOffset: fields.get("payMonthOffset") === "auto" ? null : Number(fields.get("payMonthOffset")), holidayShift: String(fields.get("holidayShift") || "previous"), location: String(fields.get("location") || "").trim(), note: String(fields.get("note") || "").trim() }
    : { ...common, workplaceId: String(fields.get("workplaceId") || ""), date: String(fields.get("date") || ""), start: String(fields.get("start") || ""), end: String(fields.get("end") || ""), breakMinutes: Number(fields.get("breakMinutes")), note: String(fields.get("note") || "").trim() };
  const error = kind === "workplace" ? validateWorkplace(record) : validateWorkShift(record, state.workplaces);
  if (error) { form.querySelector("#work-form-error").textContent = error; return; }
  state.busy = true;
  try {
    await putRecord(state.db, kind === "workplace" ? "workplaces" : "workShifts", record);
    state.workEditor = null;
    if (kind === "shift") { state.workWorkplaceId = record.workplaceId; state.workMonth = workPeriodForDate(record.date, state.workplaces.find((item) => item.id === record.workplaceId)); state.workSelectedDate = record.date; state.workMode = "month"; }
    else { state.workWorkplaceId = record.id; state.workMonth = workPeriodForDate(dateKey(), record); state.workSelectedDate = dateKey(); }
    await refresh();
    toast(existing ? "変更を保存しました。" : "登録しました。");
  } catch (cause) { form.querySelector("#work-form-error").textContent = `保存できませんでした。${cause?.message || ""}`; }
  finally { state.busy = false; }
}

async function deleteWorkItem(kind, id) {
  if (kind === "workplace" && state.workShifts.some((shift) => shift.workplaceId === id)) {
    toast("この勤務先のシフトを削除・変更してから削除してください。", true);
    return;
  }
  if (!window.confirm(`${kind === "workplace" ? "勤務先" : "シフト"}を削除しますか？`)) return;
  await deleteRecord(state.db, kind === "workplace" ? "workplaces" : "workShifts", id);
  state.workEditor = null;
  await refresh();
  toast("削除しました。");
}

const LIFE_COLLECTIONS = { habit: ["habits", "habits"], checklist: ["checklists", "checklists"], shopping: ["shoppingItems", "shoppingItems"], wishlist: ["wishlistItems", "wishlistItems"], memo: ["memos", "memos"] };

function openLifeEditor(kind, id = null) {
  state.lifeEditor = { kind, id };
  render();
}

async function saveLifeForm(form) {
  if (state.busy) return;
  const { kind, id } = form.dataset;
  const fields = new FormData(form);
  const now = new Date().toISOString();
  const errorNode = form.querySelector("#life-form-error");
  if (kind === "purchase") {
    const wish = state.wishlistItems.find((item) => item.id === id);
    if (!wish || wish.purchasedAt) { errorNode.textContent = "購入済み、または存在しないほしい物です。"; return; }
    const method = String(fields.get("paymentMethod"));
    const date = String(fields.get("date") || "");
    if (!isValidDateKey(date) || !["none", "cash", "other"].includes(method)) { errorNode.textContent = "購入日と記録方法を確認してください。"; return; }
    const expense = method === "none" ? null : { id: crypto.randomUUID(), type: "expense", amount: Number(fields.get("amount")), date, category: String(fields.get("moneyCategory") || "other"), paymentMethod: method, note: `ほしい物「${wish.title}」から登録`, wishlistItemId: wish.id, createdAt: now, updatedAt: now };
    const error = expense && validateTransaction(expense,state.moneyCategories);
    if (error) { errorNode.textContent = error; return; }
    state.busy = true;
    try {
      await putWishlistPurchase(state.db, { ...wish, purchasedAt: now, purchaseDate: date, purchaseTransactionId: expense?.id || null, updatedAt: now }, expense);
      state.lifeEditor = null;
      await refresh();
      toast(expense ? "購入済みにし、家計簿へ記録しました。" : "購入済みにしました。");
    } catch (cause) { errorNode.textContent = `保存できませんでした。${cause?.message || ""}`; }
    finally { state.busy = false; }
    return;
  }
  const [store, key] = LIFE_COLLECTIONS[kind] || [];
  if (!store) return;
  const existing = id ? state[key].find((item) => item.id === id) : null;
  const common = { id: existing?.id || crypto.randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now };
  let record, error;
  if (kind === "habit") {
    record = { ...common, title: String(fields.get("title") || "").trim(), startDate: String(fields.get("startDate") || ""), days: fields.getAll("days").map(Number).sort(), note: String(fields.get("note") || "").trim() };
    error = validateHabit(record);
  } else if (kind === "checklist") {
    const lines = String(fields.get("items") || "");
    if (lines.split(/\r?\n/).filter((line) => line.trim()).length > 200) { errorNode.textContent = "持ち物は200件以内にしてください。"; return; }
    record = { ...common, title: String(fields.get("title") || "").trim(), category: String(fields.get("category") || ""), items: mergeChecklistItems(existing?.items || [], lines) };
    error = validateChecklist(record);
  } else if (kind === "shopping") {
    record = { ...common, title: String(fields.get("title") || "").trim(), quantity: String(fields.get("quantity") || "").trim(), note: String(fields.get("note") || "").trim(), checkedAt: existing?.checkedAt || null };
    error = validateShoppingItem(record);
  } else if (kind === "wishlist") {
    const rawPrice = String(fields.get("price") || "").trim();
    record = { ...common, title: String(fields.get("title") || "").trim(), price: rawPrice ? Number(rawPrice) : null, category: String(fields.get("category") || ""), priority: String(fields.get("priority") || ""), url: String(fields.get("url") || "").trim(), imageUrl: String(fields.get("imageUrl") || "").trim(), note: String(fields.get("note") || "").trim(), purchasedAt: existing?.purchasedAt || null, purchaseDate: existing?.purchaseDate || null, purchaseTransactionId: existing?.purchaseTransactionId || null };
    error = validateWishlistItem(record);
  } else if (kind === "memo") {
    const body = String(fields.get("body") || "").trim();
    record = { ...common, title: String(fields.get("title") || "").trim() || body.split(/\r?\n/).find(Boolean)?.slice(0, 120) || "", body, category: String(fields.get("category") || "") };
    error = validateMemo(record);
  }
  if (error) { errorNode.textContent = error; return; }
  state.busy = true;
  try {
    await putRecord(state.db, store, record);
    if (kind === "checklist") state.activeChecklistId = record.id;
    state.lifeEditor = null;
    await refresh();
    toast(existing ? "変更を保存しました。" : "登録しました。");
  } catch (cause) { errorNode.textContent = `保存できませんでした。${cause?.message || ""}`; }
  finally { state.busy = false; }
}

async function toggleLifeHabit(id, key) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit || !isValidDateKey(key) || key > dateKey() || !habitDueOn(habit, key)) return;
  const recordId = `${id}:${key}`;
  const existing = state.habitRecords.find((item) => item.id === recordId);
  if (existing) await deleteRecord(state.db, "habitRecords", recordId);
  else await putRecord(state.db, "habitRecords", { id: recordId, habitId: id, date: key, completedAt: new Date().toISOString() });
  await refresh();
}

async function toggleChecklistItem(id, itemId) {
  const list = state.checklists.find((item) => item.id === id);
  if (!list || !list.items.some((item) => item.id === itemId)) return;
  await putRecord(state.db, "checklists", { ...list, items: list.items.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item), updatedAt: new Date().toISOString() });
  await refresh();
}

async function toggleShopping(id) {
  const item = state.shoppingItems.find((record) => record.id === id);
  if (!item) return;
  await putRecord(state.db, "shoppingItems", { ...item, checkedAt: item.checkedAt ? null : new Date().toISOString(), updatedAt: new Date().toISOString() });
  await refresh();
}

async function resetChecklist(id) {
  const list = state.checklists.find((item) => item.id === id);
  if (!list || !list.items.some((item) => item.checked)) return;
  if (!window.confirm("このリストのチェックを全て外しますか？")) return;
  await putRecord(state.db, "checklists", { ...list, items: list.items.map((item) => ({ ...item, checked: false })), updatedAt: new Date().toISOString() });
  await refresh();
}

async function deleteLifeItem(kind, id) {
  const [store] = LIFE_COLLECTIONS[kind] || [];
  if (!store) return;
  const wish = kind === "wishlist" ? state.wishlistItems.find((item) => item.id === id) : null;
  const note = wish?.purchaseTransactionId ? "家計簿の記録は残ります。" : "";
  if (!window.confirm(`この記録を削除しますか？${note}`)) return;
  if (kind === "habit") await deleteHabit(state.db, id, state.habitRecords);
  else await deleteRecord(state.db, store, id);
  if (kind === "checklist" && state.activeChecklistId === id) state.activeChecklistId = null;
  state.lifeEditor = null;
  await refresh();
  toast("削除しました。");
}

function convertMemo(id, kind) {
  const memo = state.memos.find((item) => item.id === id);
  if (!memo || !["todo", "event"].includes(kind)) return;
  state.lifeEditor = null;
  state.selectedDate = dateKey();
  state.editor = { kind, id: null, draft: { title: memo.title, note: memo.body, category: "life", allDay: true, sourceMemoId: memo.id } };
  render();
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
  if (!window.confirm("バックアップを読み込みますか？同じIDの予定・ToDo・お金・仕事・生活の記録はファイルの内容で更新されます。")) return;
  await importBackup(state.db, data);
  state.moneyMonthInitialized=false;
  state.workMonthInitialized=false;
  await refresh();
  toast("バックアップを読み込みました。");
}

root.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if ((action === "close-editor" || action === "money-close-editor" || action === "money-close-category" || action === "work-close-editor" || action === "life-close-editor") && event.target !== button && button.classList.contains("modal-backdrop")) return;
  try {
    if (action === "tab") { const selected=button.dataset.tab; if(state.tab===selected&&!state.page){if(selected==="schedule")state.scheduleMode="calendar";else if(selected==="money")state.moneyMode="overview";else if(selected==="work")state.workMode="month";else if(selected==="life")state.lifeMode="today";} state.tab = selected; state.page = null; state.editor = null; state.moneyEditor = null; state.moneyCategoryEditor = null; state.workEditor = null; state.lifeEditor = null; render(); window.scrollTo(0, 0); }
    else if (action === "settings") { state.page = "settings"; render(); }
    else if (action === "reminders") { state.page = "reminders"; render(); }
    else if (action === "close-page") { state.page = null; render(); }
    else if (action === "goto-schedule") { state.tab = "schedule"; state.scheduleMode = "calendar"; render(); }
    else if (action === "goto-todos") { state.tab = "schedule"; state.scheduleMode = "todos"; render(); }
    else if (action === "goto-money") { state.tab = "money"; state.moneyMode = "overview"; render(); }
    else if (action === "goto-work") { state.tab = "work"; state.workMode = "month"; render(); }
    else if (action === "goto-life") { state.tab = "life"; state.lifeMode = "today"; render(); }
    else if (action === "mode-calendar") { state.scheduleMode = "calendar"; render(); }
    else if (action === "mode-todos") { state.scheduleMode = "todos"; render(); }
    else if (action === "mode") { state.scheduleMode = button.dataset.mode; render(); }
    else if (action === "previous-period" || action === "next-period") { const step = state.scheduleMode === "week" ? 7 : state.scheduleMode === "list" ? 30 : 1; state.selectedDate = addDays(state.selectedDate, step * (action === "next-period" ? 1 : -1)); render(); }
    else if (action === "previous-month") changeMonth(-1);
    else if (action === "next-month") changeMonth(1);
    else if (action === "select-day") { state.selectedDate = button.dataset.date; state.year = Number(state.selectedDate.slice(0,4)); state.month = Number(state.selectedDate.slice(5,7))-1; render(); }
    else if (action === "money-mode") { state.moneyMode = button.dataset.mode; render(); window.scrollTo(0, 0); }
    else if (action === "money-select-day") { state.moneySelectedDate = button.dataset.date; state.moneyMonth = payPeriodForDate(state.moneySelectedDate, moneyData().wallet); render(); }
    else if (action === "money-clear-day") { state.moneySelectedDate = null; render(); }
    else if (action === "money-prev-month") shiftMoneyMonth(-1);
    else if (action === "money-next-month") shiftMoneyMonth(1);
    else if (action === "money-entry-date-step") { const input=button.closest("#money-form")?.elements.namedItem("date"); if(input)input.value=addDays(input.value||dateKey(),Number(button.dataset.step)||0); }
    else if (action === "money-edit-wallet") openMoneyEditor("wallet");
    else if (action === "money-edit-payday") openMoneyEditor("payday");
    else if (action === "money-add-transaction") openMoneyEditor("transaction", null, button.dataset.type);
    else if (action === "money-edit-transaction") openMoneyEditor("transaction", button.dataset.id);
    else if (action === "money-add-fixed") openMoneyEditor("fixed");
    else if (action === "money-edit-fixed") openMoneyEditor("fixed", button.dataset.id);
    else if (action === "money-toggle-fixed") await toggleFixedPaid(button.dataset.id, button.dataset.date);
    else if (action === "money-close-editor") closeMoneyEditor();
    else if (action === "money-add-category") { const form=button.closest("#money-form"); if(form&&state.moneyEditor)state.moneyEditor.draft=Object.fromEntries(new FormData(form)); openMoneyCategoryEditor(null,button.dataset.kind); }
    else if (action === "money-edit-category") openMoneyCategoryEditor(button.dataset.id);
    else if (action === "money-close-category") { state.moneyCategoryEditor=null;render(); }
    else if (action === "money-delete-category") await deleteMoneyCategory(button.dataset.id);
    else if (action === "money-delete") await deleteMoneyItem(button.dataset.kind, button.dataset.id);
    else if (action === "work-mode") { state.workMode = button.dataset.mode; render(); }
    else if (action === "work-prev-month") shiftWorkMonth(-1);
    else if (action === "work-next-month") shiftWorkMonth(1);
    else if (action === "work-select-day") { state.workSelectedDate = button.dataset.date; state.workMonth = workPeriodForDate(state.workSelectedDate, state.workplaces.find((item) => item.id === state.workWorkplaceId)); render(); }
    else if (action === "work-add-workplace") openWorkEditor("workplace");
    else if (action === "work-edit-workplace") openWorkEditor("workplace", button.dataset.id);
    else if (action === "work-add-shift") openWorkEditor("shift", null, button.dataset.lockDate === "true");
    else if (action === "work-apply-pattern") { const form = button.closest("#work-form"); if (form) { form.elements.namedItem("workplaceId").value = button.dataset.workplaceId; form.elements.namedItem("start").value = button.dataset.start; form.elements.namedItem("end").value = button.dataset.end; form.elements.namedItem("breakMinutes").value = button.dataset.breakMinutes; form.querySelectorAll('[data-action="work-apply-pattern"]').forEach((item) => item.setAttribute("aria-pressed", String(item === button))); } }
    else if (action === "work-edit-shift") openWorkEditor("shift", button.dataset.id);
    else if (action === "work-close-editor") { state.workEditor = null; render(); }
    else if (action === "work-delete") await deleteWorkItem(button.dataset.kind, button.dataset.id);
    else if (action === "life-mode") { state.lifeMode = button.dataset.mode; render(); }
    else if (action === "life-open-checklist") { state.activeChecklistId = button.dataset.id || null; state.lifeMode = "checklists"; render(); }
    else if (action === "life-add") openLifeEditor(button.dataset.kind);
    else if (action === "life-edit") openLifeEditor(button.dataset.kind, button.dataset.id);
    else if (action === "life-buy") openLifeEditor("purchase", button.dataset.id);
    else if (action === "life-close-editor") { state.lifeEditor = null; render(); }
    else if (action === "life-toggle-habit") await toggleLifeHabit(button.dataset.id, button.dataset.date);
    else if (action === "life-toggle-checklist-item") await toggleChecklistItem(button.dataset.id, button.dataset.itemId);
    else if (action === "life-toggle-shopping") await toggleShopping(button.dataset.id);
    else if (action === "life-reset-checklist") await resetChecklist(button.dataset.id);
    else if (action === "life-delete") await deleteLifeItem(button.dataset.kind, button.dataset.id);
    else if (action === "life-memo-convert") convertMemo(button.dataset.id, button.dataset.kind);
    else if (action === "today") { state.selectedDate = dateKey(); const now = new Date(); state.month = now.getMonth(); state.year = now.getFullYear(); render(); }
    else if (action === "add-event") openEditor("event");
    else if (action === "add-todo") openEditor("todo");
    else if (action === "edit-event") openEditor("event", button.dataset.id, button.dataset.date);
    else if (action === "edit-todo") openEditor("todo", button.dataset.id);
    else if (action === "toggle-todo") await toggleTodo(button.dataset.id, button.dataset.date);
    else if (action === "close-editor") closeEditor();
    else if (action === "choose-event-delete") { state.editor.deleteScope = true; render(); }
    else if (action === "cancel-event-delete") { state.editor.deleteScope = false; render(); }
    else if (action === "delete-repeating-event") await deleteRepeatingEvent(button.dataset.scope);
    else if (action === "delete-record") await deleteItem(button.dataset.kind, button.dataset.id);
    else if (action === "export") await downloadBackup();
    else if (action === "import") root.querySelector("#backup-file")?.click();
  } catch (cause) {
    toast(cause?.message || "操作を完了できませんでした。", true);
  }
});

root.addEventListener("submit", (event) => {
  if (event.target.id === "editor-form") { event.preventDefault(); saveForm(event.target); }
  else if (event.target.id === "money-form") { event.preventDefault(); saveMoneyForm(event.target); }
  else if (event.target.id === "money-category-form") { event.preventDefault(); saveMoneyCategoryForm(event.target); }
  else if (event.target.id === "work-form") { event.preventDefault(); saveWorkForm(event.target); }
  else if (event.target.id === "life-form") { event.preventDefault(); saveLifeForm(event.target); }
});

root.addEventListener("change", async (event) => {
  if (event.target.name === "type" && event.target.closest("#money-form")) {
    const form=event.target.form;
    const kind=event.target.value;
    const categories=currentMoneyCategories();
    const checked=form.querySelector('input[name="category"]:checked')?.value;
    const selected=moneyCategoryCatalog(categories,kind).some((item)=>item.id===checked)?checked:null;
    form.querySelector(".money-entry-category-grid").innerHTML=renderMoneyCategoryChoices(selected,categories,kind);
    form.querySelector(".money-entry-amount-label").textContent=kind==="income"?"＋ 収入":"− 支出";
    form.querySelector(".money-entry-amount-card").dataset.type=kind;
    form.querySelector(".money-entry-submit").textContent=form.dataset.id?"変更を保存":kind==="income"?"収入を入力する":"支出を入力する";
    form.querySelectorAll('[data-action="money-add-category"]').forEach((button)=>button.dataset.kind=kind);
    updateMoneyEntryButton(form);
    return;
  }
  if(event.target.closest("#money-form")?.classList.contains("money-entry-form")){updateMoneyEntryButton(event.target.form);return;}
  if(event.target.closest("#money-category-form")){updateMoneyCategoryButton(event.target.form);return;}
  if (event.target.id === "workplace-filter") { state.workWorkplaceId = event.target.value; state.workMonth = workPeriodForDate(state.workSelectedDate, state.workplaces.find((item) => item.id === state.workWorkplaceId)); render(); return; }
  if (event.target.id !== "backup-file") return;
  try { await loadBackup(event.target.files?.[0]); }
  catch (cause) { toast(cause?.message || "バックアップを読み込めませんでした。", true); }
  event.target.value = "";
});

root.addEventListener("input", (event) => {
  if(event.target.closest("#money-form")?.classList.contains("money-entry-form"))updateMoneyEntryButton(event.target.form);
  if(event.target.closest("#money-category-form"))updateMoneyCategoryButton(event.target.form);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.editor) closeEditor();
  else if (event.key === "Escape" && state.moneyCategoryEditor) { state.moneyCategoryEditor = null; render(); }
  else if (event.key === "Escape" && state.moneyEditor) closeMoneyEditor();
  else if (event.key === "Escape" && state.workEditor) { state.workEditor = null; render(); }
  else if (event.key === "Escape" && state.lifeEditor) { state.lifeEditor = null; render(); }
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
