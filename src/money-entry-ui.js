import { dateKey } from "./domain.js?v=16";
import { MONEY_CATEGORY_COLORS, moneyCategoryById, moneyCategoryCatalog } from "./money-categories.js?v=16";
import { categoryBadge } from "./money-categories-ui.js?v=16";
import { icon } from "./icons.js";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function renderMoneyCategoryChoices(selected, categories = [], kind = "expense") {
  const choices = moneyCategoryCatalog(categories, kind);
  if (selected && !choices.some((item) => item.id === selected)) choices.push(moneyCategoryById(selected, categories));
  return choices.map((category) => `<label class="money-entry-category" style="--category-color:${MONEY_CATEGORY_COLORS.includes(category.color) ? category.color : "#48bfa9"}"><input type="radio" name="category" value="${escape(category.id)}" ${category.id === selected ? "checked" : ""} />${categoryBadge(category, 26)}<span>${escape(category.label)}</span></label>`).join("");
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
    <header class="money-full-header money-entry-header"><button class="money-header-icon" type="button" data-action="money-close-editor" aria-label="戻る">${icon("arrowLeft", 23)}</button><h2 class="money-sr-only" id="money-entry-title">${title}</h2><fieldset class="money-type-switch"><legend class="money-sr-only">収支</legend><label><input type="radio" name="type" value="expense" ${type === "expense" ? "checked" : ""} /><span>支出</span></label><label><input type="radio" name="type" value="income" ${type === "income" ? "checked" : ""} /><span>収入</span></label></fieldset><button class="money-header-icon" type="button" data-action="money-add-category" data-kind="${type}" aria-label="カテゴリを追加">${icon("pencil", 21)}</button></header>
    <div class="money-full-content money-entry-content">
      <div class="money-entry-rows"><div class="money-entry-row"><label for="money-entry-date">日付</label><div class="money-entry-date"><button type="button" data-action="money-entry-date-step" data-step="-1" aria-label="前の日">${icon("arrowLeft", 17)}</button><input id="money-entry-date" name="date" type="date" value="${escape(date)}" aria-label="日付" required /><button type="button" data-action="money-entry-date-step" data-step="1" aria-label="次の日">${icon("chevron", 17)}</button></div></div>
      <label class="money-entry-row"><span>メモ</span><input name="note" maxlength="2000" value="${escape(value.note || "")}" placeholder="未入力" /></label>
      <label class="money-entry-row"><span class="money-entry-amount-label">${type === "income" ? "収入" : "支出"}</span><span class="money-entry-amount"><input name="amount" type="number" min="1" step="1" inputmode="numeric" value="${escape(amount)}" placeholder="0" required /><small>円</small></span></label></div>
      <div class="money-entry-category-heading"><h3>カテゴリー</h3><button type="button" data-action="money-add-category" data-kind="${type}">${icon("plus", 16)} 追加</button></div>
      <div class="money-entry-category-grid" role="group" aria-label="カテゴリー">${renderMoneyCategoryChoices(selected, data.categories, type)}</div>
      ${editor.cashOnly ? `<input name="paymentMethod" type="hidden" value="cash" /><p class="money-entry-cash-note">現金の記録は財布残高に反映されます。</p>` : `<label class="money-entry-payment"><span>支払方法</span><select name="paymentMethod"><option value="cash" ${paymentMethod === "cash" ? "selected" : ""}>現金（財布に反映）</option><option value="other" ${paymentMethod === "other" ? "selected" : ""}>現金以外（財布に反映しない）</option></select></label>`}
    </div><footer class="money-full-footer"><p class="form-error" id="money-form-error" role="alert"></p><button class="primary-button save-button money-entry-submit" type="submit" ${ready ? "" : "disabled"}>${editor.id ? "変更を保存" : type === "income" ? "収入を入力する" : "支出を入力する"}</button>${editor.id ? `<button class="delete-button" type="button" data-action="money-delete" data-kind="transaction" data-id="${escape(editor.id)}">${icon("trash", 17)} 削除する</button>` : ""}</footer>
  </form></section></div>`;
}
