import assert from "node:assert/strict";
import test from "node:test";
import { renderLedger, renderMoneyEditor, renderWallet } from "../src/money-ui.js";

const transactions = [
  { id: "cash-income", date: "2026-09-03", type: "income", amount: 5000, category: "other", paymentMethod: "cash", note: "", createdAt: "2026-09-03T00:00:00Z" },
  { id: "salary", date: "2026-09-03", type: "income", amount: 20000, category: "salary", paymentMethod: "other", note: "", createdAt: "2026-09-03T00:10:00Z" },
  { id: "food", date: "2026-09-03", type: "expense", amount: 4350, category: "food", paymentMethod: "cash", note: "", createdAt: "2026-09-03T01:00:00Z" },
  { id: "next", date: "2026-10-01", type: "expense", amount: 500, category: "food", paymentMethod: "cash", note: "", createdAt: "2026-10-01T00:00:00Z" }
];
const data = { wallet: { id: "cash", openingBalance: 10000 }, transactions, month: "2026-09", selectedDate: null };

test("財布カレンダーは現金だけの日別・月別の動きを表示する", () => {
  const html = renderWallet(data);
  assert.match(html, /data-date="2026-09-03" aria-label="2026-09-03 収入5,000円 支出4,350円"/);
  assert.match(html, /<span>収入<\/span><b class="income">5,000円<\/b>/);
  assert.match(html, /<span>支出<\/span><b class="expense">4,350円<\/b>/);
  assert.match(html, /<span>収支<\/span><b>\+650円<\/b>/);
  assert.match(html, /10,150円/);
  assert.match(html, /data-id="cash-income"/);
  assert.doesNotMatch(html, /data-id="salary"/);
  assert.doesNotMatch(html, /data-id="next"/);
});

test("財布の日付選択は現金明細だけを絞り、全記録には従来のデータが残る", () => {
  const selected = renderWallet({ ...data, selectedDate: "2026-09-03" });
  assert.match(selected, /選んだ日の明細/);
  assert.match(selected, /data-action="money-clear-day"/);
  assert.match(selected, /data-id="food"/);
  assert.doesNotMatch(selected, /data-id="salary"/);
  const all = renderLedger(data);
  assert.match(all, /data-id="salary"/);
  assert.doesNotMatch(all, /class="ledger-grid"/);
});

test("財布からの入力は現金固定で選択日を初期値にする", () => {
  const html = renderMoneyEditor({ kind: "transaction", id: null, type: "expense", cashOnly: true }, { ...data, selectedDate: "2026-09-03" });
  assert.ok(html.includes('<input name="paymentMethod" type="hidden" value="cash" />'));
  assert.match(html, /name="date" type="date" value="2026-09-03"/);
  assert.doesNotMatch(html, /現金以外（財布に反映しない）/);
});
