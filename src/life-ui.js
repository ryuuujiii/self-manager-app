import { dateKey, formatDay } from "./domain.js?v=11";
import { CHECKLIST_CATEGORIES, habitProgress, MEMO_CATEGORIES, PRIORITIES, WISHLIST_CATEGORIES, wishlistTotal } from "./life.js?v=11";
import { MONEY_CATEGORIES } from "./money.js?v=11";
import { icon } from "./icons.js";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const yen = (value) => `${new Intl.NumberFormat("ja-JP").format(value)}円`;
const shortDate = (key) => `${Number(key.slice(5, 7))}月${Number(key.slice(8))}日`;
const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
const options = (choices, selected) => Object.entries(choices).map(([key, label]) => `<option value="${escape(key)}" ${key === selected ? "selected" : ""}>${escape(label)}</option>`).join("");
const empty = (message) => `<p class="life-empty">${escape(message)}</p>`;
const addButton = (kind, label) => `<button class="inline-add" data-action="life-add" data-kind="${kind}">${icon("plus", 17)} ${label}</button>`;

function habitRow(habit, records, today, detailed = false) {
  const progress = habitProgress(habit, records, today);
  const count = `${progress.weekDone}/${progress.weekDue}`;
  const check = progress.todayDue ? `<button class="todo-check ${progress.todayDone ? "checked" : ""}" data-action="life-toggle-habit" data-id="${escape(habit.id)}" data-date="${today}" aria-label="${escape(habit.title)}を${progress.todayDone ? "未完了に戻す" : "完了にする"}">${progress.todayDone ? icon("check", 15) : ""}</button>` : `<span class="life-not-due">—</span>`;
  const week = detailed ? `<div class="life-week-strip">${progress.week.map((key, index) => {
    const due = key >= habit.startDate && habit.days.includes(index);
    const done = progress.completed.has(key);
    const future = key > today;
    return `<button data-action="life-toggle-habit" data-id="${escape(habit.id)}" data-date="${key}" ${!due || future ? "disabled" : ""} class="${done ? "done" : ""} ${key === today ? "today" : ""}" aria-label="${escape(habit.title)} ${escape(key)} ${done ? "完了" : "未完了"}"><small>${weekdays[index]}</small><b>${done ? "✓" : due ? "○" : "·"}</b></button>`;
  }).join("")}</div>` : "";
  return `<div class="life-habit-row"><div class="life-row-top">${check}<button class="life-row-main" data-action="life-edit" data-kind="habit" data-id="${escape(habit.id)}"><strong>${escape(habit.title)}</strong><small>今週 ${count} · 連続 ${progress.streak}${habit.days.length === 7 ? "日" : "回"}${habit.note ? ` · ${escape(habit.note)}` : ""}</small></button>${icon("chevron", 15)}</div>${week}</div>`;
}

function todayScreen(data) {
  const today = dateKey();
  const due = data.habits.filter((habit) => habitProgress(habit, data.habitRecords, today).todayDue);
  const done = due.filter((habit) => habitProgress(habit, data.habitRecords, today).todayDone).length;
  const shoppingLeft = data.shoppingItems.filter((item) => !item.checkedAt).length;
  const wishlistLeft = data.wishlistItems.filter((item) => !item.purchasedAt).length;
  return `<section class="life-hero"><span>今日の進み具合</span><strong>習慣 ${done}/${due.length} 完了</strong><p>${escape(formatDay(today, { year: "numeric", month: "long", day: "numeric", weekday: "short" }))}</p><div class="life-progress"><i style="width:${due.length ? Math.round(done / due.length * 100) : 0}%"></i></div></section>
    <section class="content-card"><div class="section-heading"><h2>今日の習慣</h2><button class="text-link" data-action="life-mode" data-mode="habits">すべて見る ${icon("chevron", 14)}</button></div>${due.length ? due.map((habit) => habitRow(habit, data.habitRecords, today)).join("") : empty(data.habits.length ? "今日の習慣はありません。" : "習慣を登録すると、ここに今日の分が表示されます。")}${addButton("habit", "習慣を追加")}</section>
    <div class="life-shortcuts"><button data-action="life-mode" data-mode="checklists"><span>${icon("check", 19)}</span><strong>持ち物</strong><small>${data.checklists.length}リスト</small></button><button data-action="life-mode" data-mode="shopping"><span>${icon("wallet", 19)}</span><strong>買い物</strong><small>残り ${shoppingLeft}件</small></button><button data-action="life-mode" data-mode="wishlist"><span>${icon("life", 19)}</span><strong>ほしい物</strong><small>${wishlistLeft}件</small></button><button data-action="life-mode" data-mode="memos"><span>${icon("notes", 19)}</span><strong>メモ</strong><small>${data.memos.length}件</small></button></div>`;
}

function habitsScreen(data) {
  const today = dateKey();
  const due = data.habits.filter((habit) => habitProgress(habit, data.habitRecords, today).todayDue);
  const done = due.filter((habit) => habitProgress(habit, data.habitRecords, today).todayDone).length;
  return `<section class="content-card"><div class="section-heading"><h2>習慣・ルーティン</h2><span class="section-count">今日 ${done}/${due.length}</span></div><p class="life-note">曜日を選んで登録できます。過去7日間の丸を押すと記録を直せます。</p>${data.habits.length ? [...data.habits].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((habit) => habitRow(habit, data.habitRecords, today, true)).join("") : empty("習慣はまだありません。")}${addButton("habit", "新しい習慣を追加")}</section>`;
}

function checklistScreen(data) {
  const list = data.checklists.find((item) => item.id === data.activeChecklistId);
  if (list) {
    const checked = list.items.filter((item) => item.checked).length;
    return `<section class="content-card"><button class="text-link" data-action="life-open-checklist" data-id="">${icon("arrowLeft", 16)} リスト一覧</button><div class="section-heading"><div><span class="section-kicker green">${escape(CHECKLIST_CATEGORIES[list.category])}</span><h2>${escape(list.title)}</h2></div><span class="section-count">${checked}/${list.items.length}</span></div><div class="life-progress light"><i style="width:${list.items.length ? Math.round(checked / list.items.length * 100) : 0}%"></i></div>${list.items.length ? list.items.map((item) => `<div class="life-check-row"><button class="todo-check ${item.checked ? "checked" : ""}" data-action="life-toggle-checklist-item" data-id="${escape(list.id)}" data-item-id="${escape(item.id)}" aria-label="${escape(item.title)}を${item.checked ? "未チェックに戻す" : "チェックする"}">${item.checked ? icon("check", 15) : ""}</button><span class="${item.checked ? "done" : ""}">${escape(item.title)}</span></div>`).join("") : empty("持ち物を追加してください。")}<div class="life-inline-actions"><button class="secondary-button" data-action="life-reset-checklist" data-id="${escape(list.id)}">全て未チェックに戻す</button><button class="secondary-button" data-action="life-edit" data-kind="checklist" data-id="${escape(list.id)}">項目を編集</button></div></section>`;
  }
  return `<section class="content-card"><div class="section-heading"><h2>持ち物チェック</h2><span class="section-count">${data.checklists.length}リスト</span></div><p class="life-note">大学・バイト・旅行など、用途ごとにリストを作れます。使い終えたらチェックを戻して再利用できます。</p>${data.checklists.length ? data.checklists.map((item) => { const checked = item.items.filter((entry) => entry.checked).length; return `<button class="life-list-card" data-action="life-open-checklist" data-id="${escape(item.id)}"><span class="life-list-icon">${icon("check", 20)}</span><span><strong>${escape(item.title)}</strong><small>${escape(CHECKLIST_CATEGORIES[item.category])} · ${checked}/${item.items.length} チェック済み</small></span>${icon("chevron", 16)}</button>`; }).join("") : empty("持ち物リストはまだありません。")}${addButton("checklist", "持ち物リストを追加")}</section>`;
}

function shoppingScreen(data) {
  const active = data.shoppingItems.filter((item) => !item.checkedAt);
  const done = data.shoppingItems.filter((item) => item.checkedAt);
  const row = (item) => `<div class="life-check-row"><button class="todo-check ${item.checkedAt ? "checked" : ""}" data-action="life-toggle-shopping" data-id="${escape(item.id)}" aria-label="${escape(item.title)}を${item.checkedAt ? "未購入に戻す" : "購入済みにする"}">${item.checkedAt ? icon("check", 15) : ""}</button><button class="life-row-main ${item.checkedAt ? "done" : ""}" data-action="life-edit" data-kind="shopping" data-id="${escape(item.id)}"><strong>${escape(item.title)}</strong><small>${item.quantity ? `${escape(item.quantity)} · ` : ""}${escape(item.note || "")}</small></button></div>`;
  return `<section class="content-card"><div class="section-heading"><h2>買い物リスト</h2><span class="section-count">残り ${active.length}件</span></div><p class="life-note">日用品など、実際に買う物を管理します。ほしい物リストとは別です。</p>${active.length ? active.map(row).join("") : empty("買う物はありません。")}${addButton("shopping", "買う物を追加")}${done.length ? `<div class="completed-heading">購入済み <span>${done.length}</span></div>${done.map(row).join("")}` : ""}</section>`;
}

function wishRow(item) {
  const image = item.imageUrl ? `<img class="life-wish-image" src="${escape(item.imageUrl)}" alt="" loading="lazy" />` : `<span class="life-list-icon pink">${icon("life", 20)}</span>`;
  return `<div class="life-wish-row">${image}<div class="life-wish-main"><button data-action="life-edit" data-kind="wishlist" data-id="${escape(item.id)}"><strong>${escape(item.title)}</strong><small>${escape(WISHLIST_CATEGORIES[item.category])} · 欲しい度 ${escape(PRIORITIES[item.priority])}${item.purchasedAt ? " · 購入済み" : ""}</small></button><b>${item.price == null ? "金額未設定" : yen(item.price)}</b><div class="life-inline-actions">${item.url ? `<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">商品を見る</a>` : ""}${!item.purchasedAt ? `<button data-action="life-buy" data-id="${escape(item.id)}">購入した</button>` : ""}</div></div></div>`;
}

function wishlistScreen(data) {
  const active = data.wishlistItems.filter((item) => !item.purchasedAt).sort((a, b) => ({ high: 0, normal: 1, later: 2 })[a.priority] - ({ high: 0, normal: 1, later: 2 })[b.priority]);
  const done = data.wishlistItems.filter((item) => item.purchasedAt);
  return `<section class="life-total"><span>ほしい物の合計（価格設定済み）</span><strong>${yen(wishlistTotal(data.wishlistItems))}</strong><small>購入済みは合計に含めません。</small></section><section class="content-card"><div class="section-heading"><h2>ほしい物リスト</h2><span class="section-count">${active.length}件</span></div>${active.length ? active.map(wishRow).join("") : empty("ほしい物はまだありません。")}${addButton("wishlist", "ほしい物を追加")}${done.length ? `<div class="completed-heading">購入済み <span>${done.length}</span></div>${done.map(wishRow).join("")}` : ""}</section>`;
}

function memosScreen(data) {
  const sorted = [...data.memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return `<section class="content-card"><div class="section-heading"><h2>メモ</h2><span class="section-count">${sorted.length}件</span></div><p class="life-note">思いついたことを残し、必要なら予定やToDoへ移せます。</p>${sorted.length ? sorted.map((item) => `<div class="life-memo"><button class="life-row-main" data-action="life-edit" data-kind="memo" data-id="${escape(item.id)}"><strong>${escape(item.title)}</strong><small>${escape(MEMO_CATEGORIES[item.category])} · ${shortDate(item.updatedAt.slice(0, 10))}</small><span>${escape(item.body || "")}</span></button><div class="life-inline-actions"><button data-action="life-memo-convert" data-id="${escape(item.id)}" data-kind="todo">ToDoにする</button><button data-action="life-memo-convert" data-id="${escape(item.id)}" data-kind="event">予定にする</button></div></div>`).join("") : empty("メモはまだありません。")}${addButton("memo", "メモを追加")}</section>`;
}

export function renderLifeScreen(data) {
  const modes = [["today", "今日"], ["habits", "習慣"], ["checklists", "持ち物"], ["shopping", "買い物"], ["wishlist", "ほしい物"], ["memos", "メモ"]];
  const content = { today: todayScreen, habits: habitsScreen, checklists: checklistScreen, shopping: shoppingScreen, wishlist: wishlistScreen, memos: memosScreen }[data.mode](data);
  return `<div class="screen life-screen"><header class="screen-header"><div class="header-top"><span class="brand-mark" aria-hidden="true">${icon("life", 18)}</span><span class="brand-title">自分管理</span><span class="header-spacer"></span></div><p class="eyebrow">習慣・持ち物・買い物・メモ</p><h1>生活</h1></header><main class="screen-content"><div class="life-tabs" role="tablist" aria-label="生活の表示">${modes.map(([key, label]) => `<button role="tab" class="${data.mode === key ? "active" : ""}" aria-selected="${data.mode === key}" data-action="life-mode" data-mode="${key}">${label}</button>`).join("")}</div>${content}</main></div>`;
}

export function renderLifeEditor(editor, data) {
  if (!editor) return "";
  const collections = { habit: data.habits, checklist: data.checklists, shopping: data.shoppingItems, wishlist: data.wishlistItems, memo: data.memos, purchase: data.wishlistItems };
  const item = editor.id ? collections[editor.kind]?.find((record) => record.id === editor.id) : null;
  const labels = { habit: "習慣", checklist: "持ち物リスト", shopping: "買う物", wishlist: "ほしい物", memo: "メモ", purchase: "購入を記録" };
  const title = editor.kind === "purchase" ? "購入を記録" : `${labels[editor.kind]}を${item ? "編集" : "追加"}`;
  let fields = "";
  if (editor.kind === "habit") fields = `<label class="field"><span>習慣名</span><input name="title" maxlength="120" value="${escape(item?.title || "")}" placeholder="例：朝のスキンケア" required /></label><label class="field"><span>開始日</span><input name="startDate" type="date" value="${escape(item?.startDate || dateKey())}" required /></label><fieldset class="life-days"><legend>実施する曜日</legend>${weekdays.map((label, index) => `<label><input type="checkbox" name="days" value="${index}" ${!item || item.days.includes(index) ? "checked" : ""} />${label}</label>`).join("")}</fieldset><label class="field"><span>メモ <small>任意</small></span><textarea name="note" maxlength="2000" rows="2">${escape(item?.note || "")}</textarea></label>`;
  if (editor.kind === "checklist") fields = `<label class="field"><span>リスト名</span><input name="title" maxlength="120" value="${escape(item?.title || "")}" placeholder="例：大学の持ち物" required /></label><label class="field"><span>用途</span><select name="category">${options(CHECKLIST_CATEGORIES, item?.category || "university")}</select></label><label class="field"><span>持ち物（1行に1つ）</span><textarea name="items" rows="9" maxlength="12000" placeholder="PC&#10;充電器&#10;財布">${escape(item?.items.map((entry) => entry.title).join("\n") || "")}</textarea></label><p class="field-help">同じ名前の項目はチェック状態を引き継ぎます。</p>`;
  if (editor.kind === "shopping") fields = `<label class="field"><span>買う物</span><input name="title" maxlength="120" value="${escape(item?.title || "")}" placeholder="例：洗剤" required /></label><label class="field"><span>数量 <small>任意</small></span><input name="quantity" maxlength="80" value="${escape(item?.quantity || "")}" placeholder="例：2本" /></label><label class="field"><span>メモ <small>任意</small></span><textarea name="note" rows="2" maxlength="1000">${escape(item?.note || "")}</textarea></label>`;
  if (editor.kind === "wishlist") fields = `<label class="field"><span>商品名</span><input name="title" maxlength="120" value="${escape(item?.title || "")}" required /></label><label class="field"><span>予想金額（円） <small>任意</small></span><input name="price" type="number" min="0" step="1" inputmode="numeric" value="${item?.price ?? ""}" /></label><div class="time-fields"><label class="field"><span>カテゴリ</span><select name="category">${options(WISHLIST_CATEGORIES, item?.category || "other")}</select></label><label class="field"><span>欲しい度</span><select name="priority">${options(PRIORITIES, item?.priority || "normal")}</select></label></div><label class="field"><span>商品URL <small>任意</small></span><input name="url" type="url" inputmode="url" value="${escape(item?.url || "")}" placeholder="https://" /></label><label class="field"><span>画像URL <small>任意</small></span><input name="imageUrl" type="url" inputmode="url" value="${escape(item?.imageUrl || "")}" placeholder="https://" /></label><label class="field"><span>メモ <small>任意</small></span><textarea name="note" rows="3" maxlength="2000">${escape(item?.note || "")}</textarea></label>${item?.purchaseTransactionId ? '<p class="field-help">購入済みの金額を変更しても、家計簿の記録は変わりません。</p>' : ""}`;
  if (editor.kind === "memo") fields = `<label class="field"><span>見出し <small>空欄なら本文から作成</small></span><input name="title" maxlength="120" value="${escape(item?.title || "")}" placeholder="例：旅行の計画" /></label><label class="field"><span>内容</span><textarea name="body" rows="8" maxlength="10000" placeholder="思いついたことを自由に記入">${escape(item?.body || "")}</textarea></label><label class="field"><span>カテゴリ</span><select name="category">${options(MEMO_CATEGORIES, item?.category || "idea")}</select></label>`;
  if (editor.kind === "purchase") fields = `<p class="life-note">「${escape(item?.title || "")}」を購入済みにします。家計簿に記録するか選んでください。</p><label class="field"><span>購入日</span><input name="date" type="date" value="${dateKey()}" required /></label><label class="field"><span>家計簿への記録</span><select name="paymentMethod"><option value="none">記録しない</option><option value="cash">現金で支払った（財布残高に反映）</option><option value="other">現金以外で支払った（財布には反映しない）</option></select></label><label class="field"><span>購入金額（円） <small>家計簿に記録する場合は必須</small></span><input name="amount" type="number" min="1" step="1" inputmode="numeric" value="${item?.price || ""}" /></label><label class="field"><span>家計簿のカテゴリ</span><select name="moneyCategory">${options(MONEY_CATEGORIES, item?.category === "daily" ? "daily" : "other")}</select></label>`;
  return `<div class="modal-backdrop" data-action="life-close-editor"><section class="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="life-editor-title"><div class="sheet-handle"></div><div class="editor-heading"><button class="text-link muted" type="button" data-action="life-close-editor">キャンセル</button><h2 id="life-editor-title">${title}</h2></div><form id="life-form" data-kind="${editor.kind}" data-id="${escape(editor.id || "")}">${fields}<p class="form-error" id="life-form-error" role="alert"></p><button class="primary-button save-button" type="submit">${editor.kind === "purchase" ? "購入済みにする" : item ? "変更を保存" : "登録する"}</button>${item && editor.kind !== "purchase" ? `<button class="delete-button" type="button" data-action="life-delete" data-kind="${editor.kind}" data-id="${escape(item.id)}">${icon("trash", 17)} 削除する</button>` : ""}</form></section></div>`;
}
