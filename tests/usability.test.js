import test from "node:test";
import assert from "node:assert/strict";
import { eventCategoryCatalog, eventCategoryById } from "../src/event-categories.js";
import { validateEvent, validateTodo } from "../src/domain.js";
import { validateBackup } from "../src/db.js";
import { habitMonthProgress, validateMemo } from "../src/life.js";
import { initialRenewalDate, nextRenewalDate, subscriptionSummary, validateFixedCost, monthSummary } from "../src/money.js";
import { createDraftController } from "../src/form-drafts.js";

test("予定カテゴリは編集・削除後も既存の予定とバックアップを維持する", () => {
  const custom = { id: "custom-test", label: "ゼミ", color: "#663399" };
  const event = { id: "event", title: "ゼミ", date: "2026-10-08", allDay: true, category: custom.id };
  assert.equal(validateEvent(event, [custom]), null);
  assert.equal(eventCategoryCatalog().length, 6);
  assert.equal(eventCategoryById("university").label, "学校");
  const deleted = { ...custom, deleted: true };
  assert.equal(eventCategoryById(custom.id, [deleted]).color, "#663399");
  assert.equal(validateEvent(event, [deleted]), null);
  const backup = { format: "self-manager-backup", version: 6, events: [event], todos: [], wallets: [], transactions: [], fixedCosts: [], workplaces: [], workShifts: [], habits: [], habitRecords: [], checklists: [], shoppingItems: [], wishlistItems: [], memos: [{ id: "memo", title: "案", body: "本文", folderId: "folder" }], moneyCategories: [], eventCategories: [deleted], memoFolders: [{ id: "folder", title: "研究" }] };
  assert.equal(validateBackup(backup), backup);
  assert.throws(() => validateBackup({ ...backup, memoFolders: [] }), /フォルダ/);
  assert.throws(() => validateBackup({ ...backup, eventCategories: [] }), /予定データ/);
  assert.equal(validateTodo({ title: "提出", dueDate: "2026-10-08", dueTime: "" }), null);
  assert.equal(validateMemo({ id: "memo", title: "案", body: "本文" }), null);
});

test("年会費を月換算し、旧固定費と月末・閏年の更新日を扱う", () => {
  const old = { id: "old", title: "サブスク", amount: 1200, category: "subscription", cadence: "monthly", paymentDay: 31, startDate: "2026-01-01", paidDates: ["2026-01-31"] };
  assert.equal(initialRenewalDate(old), "2026-01-31");
  assert.equal(nextRenewalDate(old, "2026-02-01"), "2026-02-28");
  assert.equal(nextRenewalDate(old, "2026-03-01"), "2026-03-31");
  const annual = { ...old, id: "annual", amount: 12000, cadence: "yearly", renewalDate: "2024-02-29" };
  assert.equal(nextRenewalDate(annual, "2025-01-01"), "2025-02-28");
  assert.equal(nextRenewalDate(annual, "2028-01-01"), "2028-02-29");
  const withoutDate = { ...old, paymentDay: undefined, renewalDate: "" };
  assert.equal(validateFixedCost(withoutDate), null);
  assert.equal(nextRenewalDate(withoutDate), "");
  const summary = subscriptionSummary([old, annual], "2026-10-08");
  assert.deepEqual([summary.monthlyEquivalent, summary.annualTotal], [2200, 26400]);
  assert.equal(monthSummary([{ type: "income", date: "2026-10-01", amount: 10000, paymentMethod: "other" }, { type: "expense", date: "2026-10-08", amount: 3000, paymentMethod: "cash" }], "2026-10").net, 7000);
});

test("習慣履歴は月末・閏日・未来を区別して既存記録を集計する", () => {
  const habit = { id: "h", startDate: "2028-02-28", days: [0,1,2,3,4,5,6] };
  const progress = habitMonthProgress(habit, [{ habitId: "h", date: "2028-02-28" }], "2028-02", "2028-02-28");
  assert.equal(progress.days.length, 29);
  assert.deepEqual([progress.done, progress.due, progress.total], [1,1,1]);
  assert.equal(progress.days[28].future, true);
});

test("下書きは再描画・再起動を越えて復元し、保存後は残さない", () => {
  const storage = new Map();
  storage.getItem = storage.get.bind(storage);
  storage.setItem = storage.set.bind(storage);
  storage.removeItem = storage.delete.bind(storage);
  const state = { tab: "life", lifeMode: "memos", lifeEditor: { kind: "memo", id: "m" } };
  const form = { dataset: { kind: "memo", id: "m" }, elements: [{ name: "body", type: "textarea", value: "入力途中" }] };
  const root = { querySelector: (selector) => selector === "#life-form" ? form : null };
  const drafts = createDraftController(storage);
  drafts.capture(state, root);
  drafts.persist(state);
  form.elements[0].value = "保存済みの本文";
  drafts.restore(state, root);
  assert.equal(form.elements[0].value, "入力途中");
  const resumed = {};
  const restarted = createDraftController(storage);
  restarted.load(resumed);
  assert.equal(resumed.tab, "life");
  assert.equal(resumed.lifeEditor.id, "m");
  form.elements[0].value = "";
  restarted.restore(resumed, root);
  assert.equal(form.elements[0].value, "入力途中");
  resumed.lifeEditor = null;
  restarted.capture(resumed, root);
  restarted.persist(resumed);
  assert.equal(storage.size, 0);
});
