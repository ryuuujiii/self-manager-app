import { dateKey, formatDay, monthGrid } from "./domain.js";
import { icon } from "./icons.js";
import { shiftMinutes, shiftPay, shiftsForDay, workSummary } from "./work.js?v=7";

const yen = (value) => `${new Intl.NumberFormat("ja-JP").format(value)}円`;
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const hours = (minutes) => `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}`;
const monthLabel = (month) => `${Number(month.slice(0, 4))}年${Number(month.slice(5))}月`;

function shiftRow(shift, workplaces) {
  const workplace = workplaces.find((item) => item.id === shift.workplaceId);
  if (!workplace) return "";
  return `<button class="work-shift-row" data-action="work-edit-shift" data-id="${escape(shift.id)}"><span class="work-row-icon">${icon("work", 19)}</span><span class="work-row-main"><strong>${escape(workplace.name)}</strong><small>${escape(formatDay(shift.date, { month: "numeric", day: "numeric", weekday: "short" }))} · ${escape(shift.start)}〜${escape(shift.end)} · ${hours(shiftMinutes(shift))}</small></span><b>${yen(shiftPay(shift, workplace))}</b>${icon("chevron", 15)}</button>`;
}

function workCalendar(data) {
  const [year, month] = data.month.split("-").map(Number);
  const cells = monthGrid(year, month - 1);
  const selected = shiftsForDay(data.shifts, data.selectedDate);
  return `<section class="content-card work-calendar"><div class="month-control"><button class="icon-button" data-action="work-prev-month" aria-label="前月">${icon("arrowLeft", 20)}</button><h2>${monthLabel(data.month)}</h2><button class="icon-button" data-action="work-next-month" aria-label="翌月">${icon("chevron", 20)}</button></div><div class="weekdays"><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span><span>日</span></div><div class="calendar-grid">${cells.map((key) => { const dayShifts = shiftsForDay(data.shifts, key); return `<button class="day-cell ${key.startsWith(data.month) ? "" : "outside"} ${key === dateKey() ? "today" : ""} ${key === data.selectedDate ? "selected" : ""}" data-action="work-select-day" data-date="${key}" aria-label="${escape(key)} シフト${dayShifts.length}件"><span>${Number(key.slice(-2))}</span><span class="day-dots">${dayShifts.slice(0, 3).map(() => '<i class="work-dot"></i>').join("")}</span></button>`; }).join("")}</div><div class="work-day-detail"><div class="section-heading"><h2>${escape(formatDay(data.selectedDate, { month: "long", day: "numeric", weekday: "short" }))}</h2><span class="section-count">${selected.length}件</span></div>${selected.length ? selected.map((shift) => shiftRow(shift, data.workplaces)).join("") : '<p class="settings-copy">この日のシフトはありません。</p>'}<button class="inline-add" data-action="work-add-shift">${icon("plus", 17)} この日にシフトを追加</button></div></section>`;
}

function workList(data) {
  const summary = workSummary(data.shifts, data.workplaces, data.month);
  return `<section class="content-card"><div class="month-control"><button class="icon-button" data-action="work-prev-month" aria-label="前月">${icon("arrowLeft", 20)}</button><h2>${monthLabel(data.month)}</h2><button class="icon-button" data-action="work-next-month" aria-label="翌月">${icon("chevron", 20)}</button></div>${summary.shifts.length ? summary.shifts.map((shift) => shiftRow(shift, data.workplaces)).join("") : '<p class="settings-copy">この月のシフトはありません。</p>'}</section>`;
}

function workplaceList(data) {
  return `<section class="content-card"><div class="section-heading"><h2>勤務先</h2><span class="section-count">${data.workplaces.length}件</span></div>${data.workplaces.length ? data.workplaces.map((item) => `<button class="workplace-row" data-action="work-edit-workplace" data-id="${escape(item.id)}"><span class="work-row-icon">${icon("work", 19)}</span><span class="work-row-main"><strong>${escape(item.name)}</strong><small>時給 ${yen(item.hourlyWage)}${item.payday ? ` · 給料日 毎月${item.payday}日` : ""}${item.location ? ` · ${escape(item.location)}` : ""}</small></span>${icon("chevron", 16)}</button>`).join("") : '<p class="settings-copy">勤務先を登録すると、シフトで選択できます。</p>'}<button class="inline-add" data-action="work-add-workplace">${icon("plus", 17)} 勤務先を追加</button></section><div class="privacy-note">${icon("money", 18)}<p>給料見込みはシフトと勤務先の時給から計算します。財布の現金残高には自動で加算しません。</p></div>`;
}

export function renderWorkScreen(data) {
  const summary = workSummary(data.shifts, data.workplaces, data.month);
  const modes = [["month", "月"], ["list", "リスト"], ["workplaces", "勤務先"]];
  return `<div class="screen work-screen"><header class="screen-header"><div class="header-top"><span class="brand-mark" aria-hidden="true">${icon("work", 18)}</span><span class="brand-title">自分管理</span><span class="header-spacer"></span></div><p class="eyebrow">シフト・勤務時間・給料見込み</p><h1>仕事</h1></header><main class="screen-content"><div class="segmented work-modes" role="tablist" aria-label="仕事の表示">${modes.map(([key, label]) => `<button role="tab" class="${data.mode === key ? "active" : ""}" aria-selected="${data.mode === key}" data-action="work-mode" data-mode="${key}">${label}</button>`).join("")}</div>${data.mode !== "workplaces" ? `<section class="work-summary-card"><span>${monthLabel(data.month)}の給料見込み</span><strong>${yen(summary.pay)}</strong><div><span>勤務 ${summary.count}日</span><span>勤務時間 ${hours(summary.minutes)}</span></div><small>登録したシフトから計算した目安です。実際の給与や手取りとは異なります。</small></section><div class="work-actions"><button class="primary-button" data-action="work-add-shift">${icon("plus", 17)} シフトを追加</button><button class="secondary-button" data-action="work-add-workplace">勤務先を追加</button></div>${data.mode === "month" ? workCalendar(data) : workList(data)}` : workplaceList(data)}</main></div>`;
}

export function renderWorkEditor(editor, data) {
  if (!editor) return "";
  const isWorkplace = editor.kind === "workplace";
  const item = editor.id ? (isWorkplace ? data.workplaces : data.shifts).find((record) => record.id === editor.id) : null;
  const title = isWorkplace ? (item ? "勤務先を編集" : "勤務先を追加") : (item ? "シフトを編集" : "シフトを追加");
  const workplaceFields = `<label class="field"><span>勤務先名</span><input name="name" maxlength="120" value="${escape(item?.name || "")}" placeholder="例：カフェ（新宿）" required /></label><label class="field"><span>時給（円）</span><input name="hourlyWage" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="${item?.hourlyWage ?? ""}" required /></label><label class="field"><span>給料日 <small>任意</small></span><input name="payday" type="number" min="1" max="31" step="1" inputmode="numeric" value="${item?.payday ?? ""}" placeholder="例：25" /></label><label class="field"><span>場所 <small>任意</small></span><input name="location" maxlength="200" value="${escape(item?.location || "")}" /></label><label class="field"><span>メモ <small>任意</small></span><textarea name="note" rows="2" maxlength="2000">${escape(item?.note || "")}</textarea></label><p class="field-help">時給を変更すると、この勤務先の過去のシフトを含む給料見込みが再計算されます。</p>`;
  const shiftFields = `<label class="field"><span>勤務先</span><select name="workplaceId" required><option value="">選択してください</option>${data.workplaces.map((place) => `<option value="${escape(place.id)}" ${(place.id === item?.workplaceId || (!item && data.workplaces.length === 1)) ? "selected" : ""}>${escape(place.name)}（時給 ${yen(place.hourlyWage)}）</option>`).join("")}</select></label><label class="field"><span>勤務日</span><input name="date" type="date" value="${escape(item?.date || data.selectedDate || dateKey())}" required /></label><div class="time-fields"><label class="field"><span>開始</span><input name="start" type="time" value="${escape(item?.start || "09:00")}" required /></label><label class="field"><span>終了</span><input name="end" type="time" value="${escape(item?.end || "17:00")}" required /></label></div><label class="field"><span>休憩（分）</span><input name="breakMinutes" type="number" min="0" max="1439" step="1" inputmode="numeric" value="${item?.breakMinutes ?? 0}" required /></label><label class="field"><span>メモ <small>任意</small></span><textarea name="note" rows="2" maxlength="2000">${escape(item?.note || "")}</textarea></label><p class="field-help">終了が開始より早い場合は翌日終了として計算します。時給は勤務先から取得します。</p>`;
  return `<div class="modal-backdrop" data-action="work-close-editor"><section class="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="work-editor-title"><div class="sheet-handle"></div><div class="editor-heading"><button class="text-link muted" type="button" data-action="work-close-editor">キャンセル</button><h2 id="work-editor-title">${title}</h2></div><form id="work-form" data-kind="${editor.kind}" data-id="${escape(editor.id || "")}">${isWorkplace ? workplaceFields : shiftFields}<p class="form-error" id="work-form-error" role="alert"></p><button class="primary-button save-button" type="submit">${item ? "変更を保存" : "登録する"}</button>${item ? `<button class="delete-button" type="button" data-action="work-delete" data-kind="${editor.kind}" data-id="${escape(editor.id)}">${icon("trash", 17)} 削除する</button>` : ""}</form></section></div>`;
}
