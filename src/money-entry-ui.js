import { dateKey } from "./domain.js?v=24";
import { MONEY_CATEGORY_COLORS, moneyCategoryById, moneyCategoryCatalog } from "./money-categories.js?v=24";
import { categoryBadge } from "./money-categories-ui.js?v=24";
import { icon } from "./icons.js?v=24";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function renderMoneyCategoryChoices(selected, categories = [], kind = "expense") {
  const choices = moneyCategoryCatalog(categories, kind);
  if (selected && !choices.some((item) => item.id === selected)) choices.push(moneyCategoryById(selected, categories));
  return choices.map((category) => `<label class="money-entry-category" style="--category-color:${MONEY_CATEGORY_COLORS.includes(category.color) ? category.color : "#48bfa9"}"><input type="radio" name="category" value="${escape(category.id)}" ${category.id === selected ? "checked" : ""} />${categoryBadge(category, 23)}<span>${escape(category.label)}</span><span class="money-entry-category-check" aria-hidden="true">✓</span></label>`).join("");
}

export function renderMoneyTransactionEditor(editor, data) {
  if (!editor || editor.kind !== "transaction") return "";
  const item = editor.id ? data.transactions.find((record) => record.id === editor.id) : null;
  const value = { ...item, ...editor.draft };
  const type = value.type || editor.type || "expense";
  const selected = value.category || "";
  const amount = value.amount ?? "";
  const date = value.date || (data.mode === "overview" ? dateKey() : data.selectedDate || dateKey());
  const paymentMethod = editor.cashOnly ? "cash" : value.paymentMethod || "cash";
  const ready = Number(amount) > 0 && Boolean(selected);
  const title = editor.id ? "収支を編集" : editor.cashOnly ? "現金を記録" : "収支を追加";
  return `<div class="modal-backdrop money-form-backdrop" data-action="money-close-editor"><section class="editor-sheet money-full-sheet money-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="money-entry-title"><form id="money-form" class="money-entry-form" data-kind="transaction" data-id="${escape(editor.id || "")}">
    <header class="money-full-header money-entry-header"><button class="money-header-icon" type="button" data-action="money-close-editor" aria-label="戻る">${icon("arrowLeft", 20)}</button><div class="money-header-title"><span>MY MONEY</span><h2 id="money-entry-title">${title}</h2></div><span class="money-header-tag">${editor.cashOnly ? "現金" : "収支"}</span></header>
    <div class="money-full-content money-entry-content">
      <fieldset class="money-type-switch"><legend class="money-sr-only">収支</legend><label><input type="radio" name="type" value="expense" ${type === "expense" ? "checked" : ""} /><span><b>−</b> 支出</span></label><label><input type="radio" name="type" value="income" ${type === "income" ? "checked" : ""} /><span><b>＋</b> 収入</span></label></fieldset>
      <section class="money-entry-amount-card" data-type="${type}"><label for="money-entry-amount">記録する金額 <span class="money-entry-amount-label">${type === "income" ? "＋ 収入" : "− 支出"}</span></label><span class="money-entry-amount"><input id="money-entry-amount" name="amount" type="number" min="1" step="1" inputmode="numeric" value="${escape(amount)}" placeholder="0" required /><small>円</small></span></section>
      <div class="money-entry-rows"><div class="money-entry-row"><label for="money-entry-date">日付</label><div class="money-entry-date"><button type="button" data-action="money-entry-date-step" data-step="-1" aria-label="前の日">${icon("arrowLeft", 17)}</button><input id="money-entry-date" name="date" type="date" value="${escape(date)}" aria-label="日付" required /><button type="button" data-action="money-entry-date-step" data-step="1" aria-label="次の日">${icon("chevron", 17)}</button></div></div>
      <label class="money-entry-row"><span>メモ</span><input name="note" maxlength="2000" value="${escape(value.note || "")}" placeholder="何に使ったかをメモ" /></label></div>
      <div class="money-entry-category-heading"><div><span class="money-section-index">01 / 分類</span><h3>カテゴリを選ぶ</h3></div><button type="button" data-action="money-add-category" data-kind="${type}">${icon("plus", 16)} 新しく作る</button></div>
      <div class="money-entry-category-grid" role="group" aria-label="カテゴリー">${renderMoneyCategoryChoices(selected, data.categories, type)}</div>
      ${editor.cashOnly ? `<input name="paymentMethod" type="hidden" value="cash" /><p class="money-entry-cash-note">現金の記録は財布残高に反映されます。</p>` : `<label class="money-entry-payment"><span>支払方法</span><select name="paymentMethod"><option value="cash" ${paymentMethod === "cash" ? "selected" : ""}>現金（財布に反映）</option><option value="other" ${paymentMethod === "other" ? "selected" : ""}>現金以外（財布に反映しない）</option></select></label>`}
    </div><footer class="money-full-footer"><p class="form-error" id="money-form-error" role="alert"></p><button class="primary-button save-button money-entry-submit" type="submit" ${ready ? "" : "disabled"}>${editor.id ? "変更を保存" : type === "income" ? "収入を入力する" : "支出を入力する"}</button>${editor.id ? `<button class="delete-button" type="button" data-action="money-delete" data-kind="transaction" data-id="${escape(editor.id)}">${icon("trash", 17)} 削除する</button>` : ""}</footer>
  </form></section></div>`;
}
