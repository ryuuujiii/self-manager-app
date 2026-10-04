import { MONEY_CATEGORY_COLORS, MONEY_CATEGORY_ICONS, moneyCategoryById, moneyCategoryCatalog } from "./money-categories.js?v=19";
import { icon } from "./icons.js?v=19";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function categoryBadge(category, size = 19) {
  const color = MONEY_CATEGORY_COLORS.includes(category.color) ? category.color : "#48bfa9";
  return `<span class="money-cat-badge" data-icon="${escape(category.icon)}" style="--category-color:${color}" aria-hidden="true">${icon(category.icon, size)}</span>`;
}

export function renderMoneyCategories(data) {
  const section = (kind, title) => `<section class="content-card category-manager"><div class="section-heading"><div><span class="section-kicker green">${kind === "expense" ? "支出" : "収入"}</span><h2>${title}</h2></div></div>${moneyCategoryCatalog(data.categories, kind).map((category) => `<button class="category-manager-row" data-action="money-edit-category" data-id="${escape(category.id)}">${categoryBadge(category)}<span><strong>${escape(category.label)}</strong><small>${category.kind === "both" ? "以前の共通カテゴリ" : category.builtin ? "標準カテゴリ" : "追加したカテゴリ"}</small></span>${icon("chevron", 16)}</button>`).join("")}<button class="inline-add" data-action="money-add-category" data-kind="${kind}">${icon("plus", 17)} ${kind === "expense" ? "支出" : "収入"}カテゴリを追加</button></section>`;
  return `<div class="category-manager-intro"><button class="text-link" data-action="money-mode" data-mode="overview">${icon("arrowLeft", 14)} お金の概要に戻る</button><p class="settings-copy">支出と収入で使うカテゴリを分けて管理できます。</p></div>${section("expense", "支出カテゴリ")}${section("income", "収入カテゴリ")}`;
}

export function renderMoneyCategoryEditor(editor, data) {
  if (!editor) return "";
  const category = editor.id ? moneyCategoryById(editor.id, data.categories) : null;
  const builtin = Boolean(category?.builtin);
  const title = category ? "カテゴリを編集" : "新規カテゴリ";
  const currentIcon = category?.icon || "categoryBag";
  const currentColor = category?.color || MONEY_CATEGORY_COLORS[17];
  const kind = category?.kind === "both" ? "expense" : category?.kind || editor.kind || "expense";
  return `<div class="modal-backdrop money-form-backdrop" data-action="money-close-category"><section class="editor-sheet money-full-sheet money-category-sheet" role="dialog" aria-modal="true" aria-labelledby="money-category-title"><form id="money-category-form" data-id="${escape(editor.id || "")}">
    <header class="money-full-header"><button class="money-header-icon" type="button" data-action="money-close-category" aria-label="戻る">${icon("arrowLeft", 20)}</button><div class="money-header-title"><span>CUSTOMIZE</span><h2 id="money-category-title">${title}</h2></div><span class="money-header-spacer"></span></header>
    <div class="money-full-content money-category-content">
      <div class="money-category-preview" style="--preview-color:${MONEY_CATEGORY_COLORS.includes(currentColor) ? currentColor : "#48bfa9"}"><span class="money-category-preview-kicker">表示プレビュー</span><div class="money-category-preview-main"><span class="money-category-preview-icon" aria-hidden="true">${icon(currentIcon, 31)}</span><div><strong class="money-category-preview-label">${escape(category?.label || "新しいカテゴリ")}</strong><small class="money-category-preview-kind">${kind === "income" ? "収入のカテゴリ" : "支出のカテゴリ"}</small></div></div></div>
      <div class="money-category-details">${builtin ? `<div class="money-category-name-row"><span>名前</span><strong>${escape(category.label)}</strong></div>` : `<label class="money-category-name-row"><span>名前</span><input name="label" maxlength="24" value="${escape(category?.label || "")}" placeholder="カテゴリ名を入力" required /></label><label class="money-category-name-row"><span>使う場所</span><select name="kind"><option value="expense" ${kind === "expense" ? "selected" : ""}>支出用</option><option value="income" ${kind === "income" ? "selected" : ""}>収入用</option></select></label>`}</div>
      <fieldset class="money-pick-section"><legend><span class="money-section-index">01 / マーク</span>アイコンを選ぶ</legend><div class="money-icon-palette">${Object.entries(MONEY_CATEGORY_ICONS).map(([key, label]) => `<label class="money-icon-option"><input type="radio" name="icon" value="${key}" ${key === currentIcon ? "checked" : ""} /><span>${icon(key, 23)}</span><small>${escape(label)}</small></label>`).join("")}</div></fieldset>
      <fieldset class="money-pick-section"><legend><span class="money-section-index">02 / いろ</span>目印の色を選ぶ</legend><div class="money-color-palette">${MONEY_CATEGORY_COLORS.map((color, index) => `<label class="money-color-option" style="--swatch:${color}"><input type="radio" name="color" value="${color}" aria-label="カラー ${index + 1}" ${color === currentColor ? "checked" : ""} /><span aria-hidden="true"></span></label>`).join("")}</div></fieldset>
    </div><footer class="money-full-footer"><p class="form-error" id="money-category-error" role="alert"></p><button class="primary-button save-button" type="submit" ${!category ? "disabled" : ""}>保存する</button>${category && !builtin ? `<button class="delete-button" type="button" data-action="money-delete-category" data-id="${escape(category.id)}">${icon("trash", 17)} このカテゴリを削除</button>` : ""}</footer>
  </form></section></div>`;
}
