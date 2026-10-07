import test from "node:test";
import assert from "node:assert/strict";
import { habitDueOn, habitProgress, mergeChecklistItems, validateChecklist, validateHabit, validateMemo, validateShoppingItem, validateWishlistItem, wishlistTotal } from "../src/life.js";
import { renderLifeEditor, renderLifeScreen } from "../src/life-ui.js";
import { cashBalance, validateTransaction } from "../src/money.js";
import { validateBackup } from "../src/db.js";

const habit = { id: "study", title: "英語学習", startDate: "2026-09-27", days: [0, 1, 2, 3, 4, 5, 6], note: "" };
const record = (date) => ({ id: `study:${date}`, habitId: "study", date, completedAt: `${date}T10:00:00Z` });
const baseData = { mode: "today", activeChecklistId: null, habits: [], habitRecords: [], checklists: [], shoppingItems: [], wishlistItems: [], memos: [] };

test("習慣は指定曜日だけ対象にし、週間達成と連続回数を履歴から求める", () => {
  const records = [record("2026-09-28"), record("2026-09-29"), record("2026-09-30")];
  assert.equal(validateHabit(habit), null);
  assert.equal(habitDueOn(habit, "2026-10-01"), true);
  const progress = habitProgress(habit, records, "2026-10-01");
  assert.deepEqual([progress.weekDone, progress.weekDue, progress.streak, progress.todayDone], [3, 7, 3, false]);
  const twice = { ...habit, days: [1, 3] };
  assert.equal(habitDueOn(twice, "2026-10-01"), false);
  assert.deepEqual([habitProgress(twice, [records[0], records[2]], "2026-10-01").weekDone, habitProgress(twice, [records[0], records[2]], "2026-10-01").streak], [2, 2]);
});

test("持ち物テンプレートの未変更項目はチェック状態を保持する", () => {
  const previous = [{ id: "pc", title: "PC", checked: true }, { id: "wallet", title: "財布", checked: false }];
  const items = mergeChecklistItems(previous, "PC\n充電器\n財布", () => "charger");
  assert.deepEqual(items, [previous[0], { id: "charger", title: "充電器", checked: false }, previous[1]]);
  assert.equal(validateChecklist({ id: "list", title: "大学", category: "university", items }), null);
  assert.match(renderLifeScreen({ ...baseData, mode: "checklists", activeChecklistId: "list", checklists: [{ id: "list", title: "大学", category: "university", items }] }), /全て未チェックに戻す/);
});

test("ほしい物の購入は現金選択時だけ財布残高に反映し、購入済みは合計から除く", () => {
  const wish = { id: "chair", title: "椅子", price: 5000, category: "daily", priority: "high", url: "", imageUrl: "", note: "" };
  assert.equal(validateWishlistItem(wish), null);
  assert.equal(wishlistTotal([wish, { ...wish, id: "bought", purchasedAt: "2026-10-01T00:00:00Z" }]), 5000);
  const expense = { id: "expense", type: "expense", amount: 5000, date: "2026-10-01", category: "daily", paymentMethod: "cash", note: "椅子" };
  assert.equal(validateTransaction(expense), null);
  assert.equal(cashBalance({ openingBalance: 10000 }, [expense]), 5000);
  assert.equal(cashBalance({ openingBalance: 10000 }, [{ ...expense, paymentMethod: "other" }]), 10000);
  const purchase = renderLifeEditor({ kind: "purchase", id: "chair" }, { ...baseData, wishlistItems: [wish] });
  assert.match(purchase, /現金で支払った（財布残高に反映）/);
  assert.match(purchase, /現金以外で支払った（財布には反映しない）/);
});

test("生活データを含むバックアップv4を検証し、メモの変換ボタンを表示する", () => {
  const memo = { id: "memo", title: "旅行予約", body: "宿を探す", category: "travel", updatedAt: "2026-10-01T00:00:00Z" };
  const shopping = { id: "shopping", title: "洗剤", quantity: "1本", note: "", checkedAt: null };
  assert.equal(validateMemo(memo), null);
  assert.equal(validateShoppingItem(shopping), null);
  const backup = { format: "self-manager-backup", version: 4, events: [], todos: [], wallets: [], transactions: [], fixedCosts: [], workplaces: [], workShifts: [], habits: [habit], habitRecords: [record("2026-09-28")], checklists: [], shoppingItems: [shopping], wishlistItems: [], memos: [memo] };
  assert.equal(validateBackup(backup), backup);
  assert.throws(() => validateBackup({ ...backup, habits: [] }), /習慣履歴/);
  assert.match(renderLifeScreen({ ...baseData, mode: "memos", memos: [memo] }), /ToDoにする/);
  assert.match(renderLifeScreen({ ...baseData, mode: "memos", memos: [memo] }), /予定にする/);
});
