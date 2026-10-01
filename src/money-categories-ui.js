import { MONEY_CATEGORY_ICONS, moneyCategoryById, moneyCategoryCatalog } from "./money-categories.js?v=14";
import { icon } from "./icons.js";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function categoryBadge(category, size = 19) {
  return `<span class="money-cat-badge" data-icon="${escape(category.icon)}" aria-hidden="true">${icon(category.icon, size)}</span>`;
}

export function renderMoneyCategories(data) {
  const section = (kind, title) => `<section class="content-card category-manager"><div class="section-heading"><div><span class="section-kicker green">${kind === "expense" ? "支出" : "収入"}</span><h2>${title}</h2></div></div>${moneyCategoryCatalog(data.categories, kind).map((category) => `<button class="category-manager-row" data-action="money-edit-category" data-id="${escape(category.id)}">${categoryBadge(category)}<span><strong>${escape(category.label)}</strong><small>${category.kind === "both" ? "以前の共通カテゴリ" : category.builtin ? "標準カテゴリ" : "追加したカテゴリ"}</small></span>${icon("chevron", 16)}</button>`).join("")}<button class="inline-add" data-action="money-add-category" data-kind="${kind}">${icon("plus", 17)} ${kind === "expense" ? "支出" : "収入"}カテゴリを追加</button></section>`;
  return `<div class="category-manager-intro"><button class="text-link" data-action="money-mode" data-mode="overview">${icon("arrowLeft", 14)} お金の概要に戻る</button><p class="settings-copy">支出と収入で使うカテゴリを分けて管理できます。</p></div>${section("expense", "支出カテゴリ")}${section("income", "収入カテゴリ")}`;
}

export function renderMoneyCategoryEditor(editor, data) {
  if (!editor) return "";
  const category = editor.id ? moneyCategoryById(editor.id, data.categories) : null;
  const builtin = Boolean(category?.builtin);
  const title = !category ? "カテゴリを追加" : builtin ? "アイコンを変更" : "カテゴリを編集";
  const currentIcon = category?.icon || "categoryDots";
  const kind = category?.kind === "both" ? "expense" : category?.kind || editor.kind || "expense";
  return `<div class="modal-backdrop" data-action="money-close-category"><section class="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="money-category-title"><div class="sheet-handle"></div><div class="editor-heading"><button class="text-link muted" type="button" data-action="money-close-category">キャンセル</button><h2 id="money-category-title">${title}</h2></div><form id="money-category-form" data-id="${escape(editor.id || "")}">${builtin ? `<p class="category-builtin-name">${categoryBadge(category)} <strong>${escape(category.label)}</strong></p>` : `<label class="field"><span>種類</span><select name="kind"><option value="expense" ${kind === "expense" ? "selected" : ""}>支出用</option><option value="income" ${kind === "income" ? "selected" : ""}>収入用</option></select></label><label class="field"><span>カテゴリ名</span><input name="label" maxlength="24" value="${escape(category?.label || "")}" placeholder="例：趣味・推し活" required /></label>`}<fieldset class="category-icon-field"><legend>アイコンを選択</legend><div class="category-icon-grid">${Object.entries(MONEY_CATEGORY_ICONS).map(([key, label]) => `<label class="category-icon-choice"><input type="radio" name="icon" value="${key}" ${key === currentIcon ? "checked" : ""} /><span>${icon(key, 22)}</span><small>${escape(label)}</small></label>`).join("")}</div></fieldset><p class="form-error" id="money-category-error" role="alert"></p><button class="primary-button save-button" type="submit">保存する</button>${category && !builtin ? `<button class="delete-button" type="button" data-action="money-delete-category" data-id="${escape(category.id)}">${icon("trash", 17)} このカテゴリを削除</button>` : ""}</form></section></div>`;
}
