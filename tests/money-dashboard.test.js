import assert from "node:assert/strict";
import test from "node:test";
import { dateKey } from "../src/domain.js";
import { validateBackup } from "../src/db.js";
import { moneyCategoryById, moneyCategoryCatalog, resolveMoneyCategories, validateMoneyCategory } from "../src/money-categories.js";
import { validateFixedCost, validateTransaction } from "../src/money.js";
import { cashTrendDays, moneyOptions, renderMoneyEditor, renderMoneyScreen } from "../src/money-ui.js";
import { renderMoneyCategoryEditor } from "../src/money-categories-ui.js";

const custom = { id: "custom-12345678-1234-1234-1234-123456789abc", label: "推し活", icon: "categoryHeart" };

test("お金を開くと財布残高・現金入力・統計が先に表示され、カレンダーは別表示になる", () => {
  const today = dateKey();
  const data = { mode: "overview", wallet: { id: "cash", openingBalance: 10000 }, transactions: [
    { id: "spent", type: "expense", amount: 1800, date: today, category: custom.id, paymentMethod: "cash", note: "", createdAt: `${today}T09:00:00Z` },
    { id: "not-cash", type: "expense", amount: 900, date: today, category: "food", paymentMethod: "other", note: "", createdAt: `${today}T10:00:00Z` }
  ], fixedCosts: [], categories: [custom], month: today.slice(0, 7), selectedDate: null };
  const overview = renderMoneyScreen(data);
  assert.match(overview, /現在の財布残高/);
  assert.match(overview, /8,200円/);
  assert.match(overview, /現金を記録/);
  assert.equal((overview.match(/data-action="money-add-transaction"/g) || []).length, 1);
  assert.match(overview, /推し活/);
  assert.match(overview, /data-icon="categoryHeart"/);
  assert.match(overview, /直近7日間の現金収支/);
  assert.doesNotMatch(overview, /class="ledger-grid"/);
  const calendar = renderMoneyScreen({ ...data, mode: "wallet" });
  assert.match(calendar, /class="ledger-grid"/);
  assert.equal((calendar.match(/data-action="money-add-transaction"/g) || []).length, 1);
});

test("支出用と収入用のカテゴリを別々に選び、以前の共通カテゴリは残す", () => {
  const income = { ...custom, id: "custom-12345678-1234-1234-1234-123456789abd", label: "お小遣い", kind: "income" };
  const expense = { ...custom, kind: "expense" };
  assert.deepEqual(moneyCategoryCatalog([income, expense], "income").some((item) => item.id === expense.id), false);
  assert.deepEqual(moneyCategoryCatalog([income, expense], "expense").some((item) => item.id === income.id), false);
  assert.match(moneyOptions("incomeOther", [income, expense], "income"), /お小遣い/);
  assert.doesNotMatch(moneyOptions("incomeOther", [income, expense], "income"), /推し活/);
  assert.match(moneyOptions("other", [income, expense], "expense"), /推し活/);
  assert.doesNotMatch(moneyOptions("other", [income, expense], "expense"), /お小遣い/);
  assert.equal(moneyCategoryCatalog([custom], "income").some((item) => item.id === custom.id), true);
  assert.equal(resolveMoneyCategories([custom], [{ category: custom.id, type: "expense" }])[0].kind, "expense");
  assert.equal(resolveMoneyCategories([custom], [{ category: custom.id, type: "income" }])[0].kind, "income");
  assert.equal(resolveMoneyCategories([custom], [{ category: custom.id, type: "income" }, { category: custom.id, type: "expense" }])[0].kind, "both");
  assert.match(validateMoneyCategory({ ...income, kind: "both" }), /種類/);
  const data = { wallet: null, transactions: [], fixedCosts: [], categories: [income, expense], mode: "overview" };
  const editor = renderMoneyEditor({ kind: "transaction", type: "income", cashOnly: true }, data);
  assert.match(editor, /class="money-entry-category-grid"/);
  assert.match(editor, /name="type" value="income" checked/);
  assert.match(editor, /お小遣い/);
  assert.doesNotMatch(editor, /推し活/);
  assert.match(editor, /収入を入力する/);
});

test("入力はアイコン付きカテゴリを選び、カテゴリ作成では色も選べる", () => {
  const data = { wallet: null, transactions: [], fixedCosts: [], categories: [], mode: "overview" };
  const entry = renderMoneyEditor({ kind: "transaction", type: "expense", cashOnly: true }, data);
  assert.match(entry, /money-entry-amount-card/);
  assert.match(entry, /money-entry-amount-card" data-type="expense"/);
  assert.match(entry, /money-entry-category-grid/);
  assert.match(entry, /食費/);
  assert.match(entry, /新しく作る/);
  assert.match(entry, /支出を入力する/);
  assert.doesNotMatch(entry, /autofocus/);
  const incomeEntry = renderMoneyEditor({ kind: "transaction", type: "income", cashOnly: true }, data);
  assert.match(incomeEntry, /money-entry-amount-card" data-type="income"/);
  const category = renderMoneyCategoryEditor({ id: null, kind: "expense" }, data);
  assert.match(category, /money-category-preview/);
  assert.match(category, /money-icon-palette/);
  assert.match(category, /money-color-palette/);
  assert.match(category, /name="color"/);
  assert.equal(validateMoneyCategory({ ...custom, kind: "expense", color: "#48bfa9" }), null);
  assert.match(validateMoneyCategory({ ...custom, color: "red; background:url(x)" }), /カラー/);
  assert.equal(moneyCategoryById(custom.id, [{ ...custom, color: "#ec737c" }]).color, "#ec737c");
});

test("最近7日のグラフは現金のみを日別に集計する", () => {
  const records = [
    { date: "2026-10-01", paymentMethod: "cash", type: "income", amount: 1200 },
    { date: "2026-10-01", paymentMethod: "cash", type: "expense", amount: 300 },
    { date: "2026-10-01", paymentMethod: "other", type: "expense", amount: 5000 },
    { date: "2026-09-24", paymentMethod: "cash", type: "expense", amount: 100 }
  ];
  const days = cashTrendDays(records, "2026-10-01");
  assert.equal(days.length, 7);
  assert.equal(days[0].day, "2026-09-25");
  assert.deepEqual(days[6], { day: "2026-10-01", income: 1200, expense: 300 });
});

test("追加カテゴリを収支と固定費に使い、アイコンと一緒にバックアップできる", () => {
  assert.equal(validateMoneyCategory(custom), null);
  assert.equal(moneyCategoryById(custom.id, [custom]).icon, "categoryHeart");
  assert.equal(moneyCategoryCatalog([{ id: "food", label: "食費", icon: "categoryGift" }]).find((item) => item.id === "food").icon, "categoryGift");
  const transaction = { id: "t", type: "expense", amount: 1000, date: "2026-10-01", category: custom.id, paymentMethod: "cash", note: "" };
  const fixedCost = { id: "f", title: "定期購入", amount: 500, category: custom.id, cadence: "monthly", paymentDay: 1, startDate: "2026-10-01" };
  assert.equal(validateTransaction(transaction, [custom]), null);
  assert.equal(validateFixedCost(fixedCost, [custom]), null);
  assert.match(validateTransaction(transaction), /カテゴリ/);
  const backup = { format: "self-manager-backup", version: 5, events: [], todos: [], wallets: [], transactions: [transaction], fixedCosts: [fixedCost], workplaces: [], workShifts: [], habits: [], habitRecords: [], checklists: [], shoppingItems: [], wishlistItems: [], memos: [], moneyCategories: [custom] };
  assert.equal(validateBackup(backup), backup);
  assert.throws(() => validateBackup({ ...backup, moneyCategories: [] }), /家計簿データ/);
  assert.match(validateMoneyCategory({ ...custom, icon: "unknown" }), /アイコン/);
});
