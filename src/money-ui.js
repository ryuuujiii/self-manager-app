import { cashBalance, monthSummary, subscriptionSummary, initialRenewalDate, nextRenewalDate } from "./money.js?v=27";
import { addDays, calendarDayLabel, dateKey, formatDay } from "./domain.js?v=27";
import { payPeriod, payPeriodForDate, periodGrid, periodSummary } from "./pay-cycle.js?v=27";
import { moneyCategoryById, moneyCategoryCatalog } from "./money-categories.js?v=27";
import { categoryBadge, renderMoneyCategories } from "./money-categories-ui.js?v=27";
import { renderMoneyTransactionEditor } from "./money-entry-ui.js?v=27";
import { icon } from "./icons.js?v=27";
import { renderExpenseDonut, renderMoneyTrend } from "./money-charts.js?v=27";
export function escapeMoney(value){return String(value??"").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}

export function yen(amount){return `${new Intl.NumberFormat("ja-JP").format(amount)}円`;}

export function moneyMonthLabel(month){const [y,m]=month.split("-").map(Number);return `${y}年${m}月`;}

export function moneyOptions(selected, categories=[], kind="expense"){
  const choices=moneyCategoryCatalog(categories,kind);
  if(selected&&!choices.some((item)=>item.id===selected))choices.push(moneyCategoryById(selected,categories));
  return choices.map(({id,label})=>`<option value="${escapeMoney(id)}" ${id===selected?"selected":""}>${escapeMoney(label)}</option>`).join("");
}

export function moneyHeader(){return `<header class="screen-header"><div class="header-top"><span class="brand-mark" aria-hidden="true">${icon("money",18)}</span><span class="brand-title">自分管理</span><span class="header-spacer"></span><button class="icon-button" data-action="settings" aria-label="設定">${icon("settings",21)}</button></div><p class="eyebrow">財布の現金・全記録・固定費</p><h1>お金</h1></header>`;}

export function transactionRow(item,categories=[]){const plus=item.type==="income",category=moneyCategoryById(item.category,categories);return `<button class="money-record" data-action="money-edit-transaction" data-id="${escapeMoney(item.id)}">${categoryBadge(category)}<span class="money-record-main"><strong>${escapeMoney(category.label)}</strong><small>${escapeMoney(item.date)} · ${item.paymentMethod==="cash"?"現金":"現金以外"}${item.note?` · ${escapeMoney(item.note)}`:""}</small></span><b class="${plus?"income":"expense"}">${plus?"+":"−"}${yen(item.amount)}</b></button>`;}

export function cashTrendDays(transactions, today=dateKey()) {
  return Array.from({length:7},(_,index)=>{
    const day=addDays(today,index-6);
    const records=transactions.filter((item)=>item.paymentMethod==="cash"&&item.date===day);
    return {day,income:records.filter((item)=>item.type==="income").reduce((sum,item)=>sum+item.amount,0),expense:records.filter((item)=>item.type==="expense").reduce((sum,item)=>sum+item.amount,0)};
  });
}

function renderCashTrend(transactions) {
  const days=cashTrendDays(transactions);
  const largest=Math.max(1,...days.flatMap((day)=>[day.income,day.expense]));
  return `<div class="cash-trend"><div class="cash-trend-heading"><strong>直近7日間の現金収支</strong><span><i class="income"></i>収入 <i class="expense"></i>支出</span></div><div class="cash-trend-grid" role="img" aria-label="${days.map((day)=>`${Number(day.day.slice(5,7))}月${Number(day.day.slice(8))}日 収入${yen(day.income)} 支出${yen(day.expense)}`).join("、")}">${days.map((day)=>`<div class="cash-trend-day"><div class="cash-trend-bars"><i class="income" style="height:${day.income?Math.max(5,Math.round(day.income/largest*100)):0}%"></i><i class="expense" style="height:${day.expense?Math.max(5,Math.round(day.expense/largest*100)):0}%"></i></div><small>${Number(day.day.slice(5,7))}/${Number(day.day.slice(8))}</small></div>`).join("")}</div></div>`;
}

export function renderMoneyDashboard(data) {
  const balance = cashBalance(data.wallet, data.transactions);
  const cash = data.transactions.filter((item) => item.paymentMethod === "cash");
  const period = payPeriod(payPeriodForDate(dateKey(), data.wallet), data.wallet);
  const summary = periodSummary(cash, period.start, period.end);
  const expenses = moneyCategoryCatalog(data.categories).map((category) => ({ ...category, amount: summary.records.filter((item) => item.type === "expense" && item.category === category.id).reduce((sum, item) => sum + item.amount, 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const largest = expenses[0]?.amount || 1;
  const recent = [...cash].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
  const shortDay = (key) => `${Number(key.slice(5, 7))}月${Number(key.slice(8))}日`;
  return `<section class="wallet-hero money-overview-hero"><span>${icon("wallet", 25)} 現在の財布残高</span><strong>${yen(balance)}</strong><small>現金の入出金だけを反映</small><button data-action="money-edit-wallet">${data.wallet ? "初期残高を変更" : "初期残高を設定"}</button></section>
    <div class="money-quick-actions"><button data-action="money-add-transaction" data-type="expense">${icon("plus", 19)}<span>現金を記録</span></button></div>
    <section class="content-card money-insight-card"><div class="section-heading"><div><span class="section-kicker green">財布の動き</span><h2>この期間の現金収支</h2></div><button class="text-link" data-action="money-mode" data-mode="wallet">カレンダー ${icon("chevron", 14)}</button></div><p class="money-insight-period">${shortDay(period.start)}〜${shortDay(period.end)}${period.nextPayday ? ` · 次の給料日 ${shortDay(period.nextPayday.actual)}` : ""}</p><div class="money-insight-totals"><div><span>収入</span><strong class="income">+${yen(summary.income)}</strong></div><div><span>支出</span><strong class="expense">−${yen(summary.expense)}</strong></div><div><span>差し引き</span><strong>${summary.net < 0 ? "−" : "+"}${yen(Math.abs(summary.net))}</strong></div></div><p class="field-help">固定費・サブスクは財布残高に反映しません。</p></section>
    <section class="content-card money-insight-card"><div class="section-heading"><div><span class="section-kicker green">支出の内訳</span><h2>カテゴリ別</h2></div><button class="text-link" data-action="money-mode" data-mode="categories">編集 ${icon("chevron", 14)}</button></div>${expenses.length ? expenses.map((item) => `<div class="money-category-stat">${categoryBadge(item)}<span class="money-category-stat-main"><span><strong>${escapeMoney(item.label)}</strong><b>${yen(item.amount)}</b></span><i><em style="width:${Math.max(3, Math.round(item.amount / largest * 100))}%"></em></i></span></div>`).join("") : `<p class="settings-copy">この期間の現金支出はありません。</p>`}<button class="inline-add" data-action="money-mode" data-mode="categories">${icon("plus", 16)} カテゴリ・アイコンを管理</button></section>
    <section class="content-card"><div class="section-heading"><h2>最近の現金の動き</h2><button class="text-link" data-action="money-mode" data-mode="ledger">全記録を見る ${icon("chevron", 14)}</button></div>${renderCashTrend(cash)}${recent.length ? recent.map((item) => transactionRow(item, data.categories)).join("") : `<p class="settings-copy">まだ現金の記録はありません。</p>`}</section>`;
}

export function renderWallet(data) {
  const balance = cashBalance(data.wallet, data.transactions);
  const cash = data.transactions.filter((item) => item.paymentMethod === "cash");
  const period = payPeriod(data.month, data.wallet);
  const summary = periodSummary(cash, period.start, period.end);
  const shortDay = (key) => `${Number(key.slice(5, 7))}月${Number(key.slice(8))}日`;
  const salaryRule = data.wallet?.salaryDay
    ? `給料日：毎月${data.wallet.salaryDay}日（土日・祝日は${data.wallet.holidayShift === "next" ? "後" : "前"}の平日）`
    : "給料日を設定すると、給料日を基準に期間を区切れます。";
  const nextPayday = period.nextPayday
    ? `次の給料日 ${shortDay(period.nextPayday.actual)}${period.nextPayday.actual !== period.nextPayday.nominal ? `（元の予定 ${shortDay(period.nextPayday.nominal)}）` : ""}`
    : "給料日の設定前は暦月で集計します。";
  return `<section class="wallet-hero"><span>${icon("wallet", 27)} 現金の財布</span><strong>${yen(balance)}</strong><small>現金の入出金だけを反映した残高</small><div class="wallet-hero-actions"><button data-action="money-edit-wallet">${data.wallet ? "初期残高を変更" : "初期残高を設定"}</button><button data-action="money-edit-payday">${data.wallet?.salaryDay ? "給料日を変更" : "給料日を設定"}</button></div></section>
    <section class="content-card pay-period-card"><div class="month-control"><button class="icon-button" data-action="money-prev-month" aria-label="前の期間">${icon("arrowLeft", 20)}</button><h2>${moneyMonthLabel(data.month)}</h2><button class="icon-button" data-action="money-next-month" aria-label="次の期間">${icon("chevron", 20)}</button></div><p class="pay-period-range">${shortDay(period.start)}〜${shortDay(period.end)} <span>締切 ${shortDay(period.end)}</span></p><p class="pay-period-note">${nextPayday}</p><p class="pay-period-note">${salaryRule}</p>${period.provisional ? `<p class="pay-period-warning">2028年以降の祝日は公式発表前の暫定計算です。</p>` : ""}</section>
    <div class="money-action-grid"><button class="secondary-button" data-action="money-add-transaction" data-type="expense">${icon("plus", 17)} 現金を記録</button></div>
    <div class="today-anchor"><span><b>今日</b> ${escapeMoney(formatDay(dateKey(), { month: "long", day: "numeric", weekday: "short" }))}</span><button data-action="money-today">今日を表示</button></div>
    ${renderLedgerCalendar({ ...data, transactions: cash }, summary, period)}`;
}

export function renderLedgerCalendar(data, summary, period) {
  const daily = new Map();
  for (const item of data.transactions) {
    const value = daily.get(item.date) || { income: 0, expense: 0 };
    value[item.type] += item.amount;
    daily.set(item.date, value);
  }
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const cells = periodGrid(period.start, period.end).map((date) => {
    const value = daily.get(date) || { income: 0, expense: 0 };
    const current = period.start <= date && date <= period.end;
    const selected = date === data.selectedDate;
    const payday = date === period.currentPayday?.actual || date === period.nextPayday?.actual;
    const closing = date === period.end && Boolean(period.nextPayday);
    return `<button class="ledger-day ${current ? "" : "outside"} ${selected ? "selected" : ""} ${date === dateKey() ? "today" : ""} ${payday ? "payday" : ""} ${closing ? "closing" : ""} ${date.endsWith("-01") ? "month-start" : ""}" data-action="money-select-day" data-date="${date}" aria-label="${date} 収入${yen(value.income)} 支出${yen(value.expense)}${date === dateKey() ? " 今日" : ""}${payday ? " 給料日" : ""}${closing ? " 締切日" : ""}" aria-pressed="${selected}">
      <span class="ledger-date">${calendarDayLabel(date)}</span>
      <span class="ledger-day-amount income">${value.income ? new Intl.NumberFormat("ja-JP").format(value.income) : "&nbsp;"}</span>
      <span class="ledger-day-amount expense">${value.expense ? new Intl.NumberFormat("ja-JP").format(value.expense) : "&nbsp;"}</span>
    </button>`;
  }).join("");
  const sorted = [...summary.records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const visible = data.selectedDate ? sorted.filter((item) => item.date === data.selectedDate) : sorted;
  const groups = new Map();
  for (const item of visible) {
    if (!groups.has(item.date)) groups.set(item.date, []);
    groups.get(item.date).push(item);
  }
  const records = [...groups].map(([date, items]) => {
    const net = items.reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0);
    return `<div class="ledger-group"><div class="ledger-group-heading"><strong>${formatDay(date, { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</strong><span class="${net >= 0 ? "income" : "expense"}">${net >= 0 ? "+" : "−"}${yen(Math.abs(net))}</span></div>${items.map((item) => transactionRow(item, data.categories)).join("")}</div>`;
  }).join("");
  return `<section class="content-card ledger-calendar-card">
    <div class="ledger-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="ledger-grid">${cells}</div>
    <div class="ledger-legend"><span class="income">● 収入</span><span class="expense">● 支出</span></div>
  </section>
  <section class="content-card"><div class="money-summary ledger-summary"><div><span>収入</span><b class="income">${yen(summary.income)}</b></div><div><span>支出</span><b class="expense">${yen(summary.expense)}</b></div><div><span>収支</span><b>${summary.net < 0 ? "−" : "+"}${yen(Math.abs(summary.net))}</b></div></div><p class="field-help">この期間の現金の収支です。</p></section>
  <section class="content-card"><div class="section-heading"><h2>${data.selectedDate ? "選んだ日の明細" : "日付別の明細"}</h2><span class="section-count">${visible.length}件</span></div>
  ${data.selectedDate ? `<button class="text-link ledger-clear" data-action="money-clear-day">期間の全件を見る</button>` : ""}
  ${records || `<p class="settings-copy">${data.selectedDate ? "この日の記録はありません。" : "この期間の記録はありません。"}</p>`}</section>`;
}

export function renderLedger(data) {
  const summary = monthSummary(data.transactions, data.month);
  const sorted = [...summary.records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return `<section class="content-card ledger-month-card"><div class="month-control"><button class="icon-button" data-action="money-prev-month" aria-label="前月">${icon("arrowLeft", 20)}</button><h2>${moneyMonthLabel(data.month)}</h2><button class="icon-button" data-action="money-next-month" aria-label="翌月">${icon("chevron", 20)}</button></div></section>
    <p class="field-help">折れ線は現金の財布残高です。円グラフと記録一覧には現金以外も含みます。</p>
    <div class="money-action-grid"><button class="secondary-button" data-action="money-add-transaction" data-type="expense">${icon("plus", 17)} 収支を記録</button></div>
    <section class="content-card"><div class="money-summary ledger-summary"><div><span>収入</span><b class="income">${yen(summary.income)}</b></div><div><span>支出</span><b class="expense">${yen(summary.expense)}</b></div><div><span>収支</span><b>${summary.net < 0 ? "−" : "+"}${yen(Math.abs(summary.net))}</b></div></div></section>
    <section class="content-card money-stat-card"><div class="section-heading"><div><span class="section-kicker green">現金の動向</span><h2>${data.trendMode === "month" ? "月末ごとの財布残高" : "日末ごとの財布残高"}</h2></div></div><div class="segmented money-trend-modes" role="group" aria-label="推移の集計単位"><button class="${data.trendMode !== "month" ? "active" : ""}" data-action="money-trend-mode" data-mode="day" aria-pressed="${data.trendMode !== "month"}">日ごと</button><button class="${data.trendMode === "month" ? "active" : ""}" data-action="money-trend-mode" data-mode="month" aria-pressed="${data.trendMode === "month"}">月ごと</button></div><p class="money-stat-caption">${data.trendMode === "month" ? `${moneyMonthLabel(data.month)}までの12か月` : `${moneyMonthLabel(data.month)}の毎日`} · 初期残高と現金の記録から計算。${data.trendMode === "month" ? "記録がない月は前月末の残高を引き継ぎます。" : "記録がない日は前日の残高を引き継ぎます。"}</p>${renderMoneyTrend(data.transactions, data.wallet, data.month, data.trendMode)}</section>
    <section class="content-card money-stat-card"><div class="section-heading"><div><span class="section-kicker green">支出の内訳</span><h2>カテゴリ別の割合</h2></div><button class="text-link" data-action="money-mode" data-mode="categories">カテゴリを編集 ${icon("chevron", 14)}</button></div><p class="money-stat-caption">${moneyMonthLabel(data.month)}の支出</p>${renderExpenseDonut(data.transactions, data.month, data.categories)}</section>
    <section class="content-card"><div class="section-heading"><h2>収支の記録</h2><span class="section-count">${sorted.length}件</span></div>${sorted.length ? sorted.map((item) => transactionRow(item, data.categories)).join("") : `<p class="settings-copy">この月の記録はありません。</p>`}</section>`;
}
export function renderFixed(data) {
  const summary = subscriptionSummary(data.fixedCosts);
  const total = summary.monthlyEquivalent;
  return `<section class="content-card"><div class="section-heading"><h2>固定費・サブスク</h2><span class="section-count">${summary.active.length}件</span></div><div class="money-summary"><div><span>月あたり目安</span><b>${yen(total)}</b></div><div><span>年間合計</span><b>${yen(summary.annualTotal)}</b></div></div><p class="field-help">月額合計 ${yen(summary.monthly)} ＋ 年会費 ${yen(summary.yearly)} ÷ 12。家計簿・財布残高には自動加算しません。</p></section><button class="primary-button money-add" data-action="money-add-fixed">${icon("plus",17)} 固定費・サブスクを追加</button><section class="content-card"><div class="section-heading"><h2>月あたりの内訳</h2></div>${summary.active.map((item) => {
    const monthly = item.cadence === "yearly" ? item.amount / 12 : item.amount;
    return `<div class="subscription-cost"><span>${escapeMoney(item.title)}</span><b>${yen(Math.round(monthly))}</b><div class="subscription-bar"><i style="width:${total ? Math.min(100,monthly / total * 100) : 0}%"></i></div></div>`;
  }).join("") || '<p class="settings-copy">まだ登録されていません。</p>'}</section><section class="content-card"><div class="section-heading"><h2>登録済みのサービス</h2></div>${data.fixedCosts.map((item) => {
    const renewal = nextRenewalDate(item);
    return `<button class="money-record" data-action="money-edit-fixed" data-id="${escapeMoney(item.id)}">${categoryBadge(moneyCategoryById(item.category,data.categories))}<span class="money-record-main"><strong>${escapeMoney(item.title)}</strong><small>${item.cadence === "monthly" ? "月額" : "年額"} · ${renewal ? `次回更新 ${escapeMoney(renewal)}` : "更新日未指定"}${item.endDate && item.endDate < dateKey() ? " · 終了済み" : ""}</small></span><b>${yen(item.amount)}</b></button>`;
  }).join("") || '<p class="settings-copy">まだ登録されていません。</p>'}</section>`;
}

export function renderMoneyScreen(data){const modes=[["overview","概要"],["wallet","カレンダー"],["ledger","全記録"],["fixed","固定費"]];return `<div class="screen money-screen">${moneyHeader()}<main class="screen-content"><div class="segmented money-modes" role="tablist" aria-label="お金の表示">${modes.map(([key,label])=>`<button role="tab" aria-selected="${data.mode===key}" class="${data.mode===key?"active":""}" data-action="money-mode" data-mode="${key}">${label}</button>`).join("")}</div>${data.mode==="overview"?renderMoneyDashboard(data):data.mode==="wallet"?renderWallet(data):data.mode==="ledger"?renderLedger(data):data.mode==="fixed"?renderFixed(data):renderMoneyCategories(data)}</main></div>`;}

export function renderMoneyEditor(editor,data){if(!editor)return "";if(editor.kind==="transaction")return renderMoneyTransactionEditor(editor,data);const {kind,id}=editor;const item=(kind==="wallet"||kind==="payday")?data.wallet:id?(kind==="transaction"?data.transactions:data.fixedCosts).find((record)=>record.id===id):null;const title=kind==="payday"?"給料日の設定":kind==="wallet"?"現金の初期残高":kind==="transaction"?(editor.cashOnly?(id?"現金の記録を編集":"現金を記録"):(id?"収支を編集":"収支を追加")):(id?"固定費を編集":"固定費を追加");const common=`<label class="field"><span>メモ <small>任意</small></span><textarea name="note" rows="3" maxlength="2000">${escapeMoney(item?.note||"")}</textarea></label>`;let fields;if(kind==="payday")fields=`<p class="field-help">前回の実際の給料日から、次回の実際の給料日の前日までを1期間にします。土日・日本の祝日には指定した方向の平日へ移動します。</p><label class="field"><span>毎月の給料日（1〜31日）</span><input name="salaryDay" type="number" min="1" max="31" step="1" inputmode="numeric" value="${item?.salaryDay ?? ""}" placeholder="例：25" /></label><p class="field-help">31日がない月は月末日を基準にします。空欄で保存すると暦月表示に戻ります。</p><label class="field"><span>給料日が土日・祝日の場合</span><select name="holidayShift"><option value="previous" ${item?.holidayShift !== "next" ? "selected" : ""}>前の平日</option><option value="next" ${item?.holidayShift === "next" ? "selected" : ""}>後の平日</option></select></label>`;else if(kind==="wallet")fields=`<p class="field-help">開始時点の現金を設定します。以後の現金の入出金を残高に反映します。</p><label class="field"><span>初期残高（円）</span><input name="openingBalance" type="number" min="0" step="1" inputmode="numeric" value="${item?.openingBalance??0}" required /></label>`;else if(kind==="transaction")fields=`<label class="field"><span>収支</span><select name="type"><option value="expense" ${(item?.type||editor.type)==="expense"?"selected":""}>支出</option><option value="income" ${(item?.type||editor.type)==="income"?"selected":""}>収入</option></select></label><label class="field"><span>金額（円）</span><input name="amount" type="number" min="1" step="1" inputmode="numeric" value="${item?.amount||""}" required /></label><label class="field"><span>日付</span><input name="date" type="date" value="${escapeMoney(item?.date||(data.mode==="overview"?dateKey():data.selectedDate||dateKey()))}" required /></label><label class="field"><span>カテゴリ</span><select name="category">${moneyOptions(item?.category||((item?.type||editor.type)==="income"?"incomeOther":"other"),data.categories,item?.type||editor.type||"expense")}</select></label>${editor.cashOnly ? `<label class="field"><span>支払方法</span><select name="paymentMethod"><option value="cash" selected>現金（財布に反映）</option></select></label>` : `<label class="field"><span>支払方法</span><select name="paymentMethod"><option value="cash" ${!item||item.paymentMethod==="cash"?"selected":""}>現金（財布に反映）</option><option value="other" ${item?.paymentMethod==="other"?"selected":""}>現金以外（財布に反映しない）</option></select></label>`}${common}`;else fields=`<label class="field"><span>名称</span><input name="title" maxlength="120" value="${escapeMoney(item?.title || "")}" required /></label><label class="field"><span>金額（円）</span><input name="amount" type="number" min="1" step="1" inputmode="numeric" value="${item?.amount || ""}" required /></label><label class="field"><span>カテゴリ</span><select name="category">${moneyOptions(item?.category || "subscription",data.categories)}</select></label><label class="field"><span>更新周期</span><select name="cadence"><option value="monthly" ${!item || item.cadence === "monthly" ? "selected" : ""}>毎月（月額）</option><option value="yearly" ${item?.cadence === "yearly" ? "selected" : ""}>毎年（年会費）</option></select></label><label class="field"><span>更新日 <small>任意</small></span><input name="renewalDate" type="date" value="${escapeMoney(item ? initialRenewalDate(item) : "")}" /></label><p class="field-help">更新日を基準に次の更新日を表示します。カレンダーには表示せず、月額・年額の集計に使います。</p>${common}`;return `<div class="modal-backdrop" data-action="money-close-editor"><section class="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="money-editor-title"><div class="sheet-handle"></div><div class="editor-heading"><button class="text-link muted" type="button" data-action="money-close-editor">キャンセル</button><h2 id="money-editor-title">${title}</h2></div><form id="money-form" data-kind="${kind}" data-id="${escapeMoney(id||"")}">${fields}<p class="form-error" id="money-form-error" role="alert"></p><button class="primary-button save-button" type="submit">${id||kind==="wallet"||kind==="payday"?"保存する":"登録する"}</button>${id&&kind!=="wallet"?`<button class="delete-button" type="button" data-action="money-delete" data-kind="${kind}" data-id="${escapeMoney(id)}">${icon("trash",17)} 削除する</button>`:""}</form></section></div>`;}
