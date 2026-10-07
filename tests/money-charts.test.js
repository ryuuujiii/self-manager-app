import test from "node:test";
import assert from "node:assert/strict";
import { expenseBreakdown, moneyTrendSeries, renderExpenseDonut, renderMoneyTrend } from "../src/money-charts.js";

const records = [
  { date: "2025-10-15", type: "expense", amount: 1000, category: "food", paymentMethod: "cash" },
  { date: "2026-09-30", type: "expense", amount: 200, category: "food", paymentMethod: "cash" },
  { date: "2026-10-02", type: "expense", amount: 600, category: "food", paymentMethod: "cash" },
  { date: "2026-10-02", type: "expense", amount: 400, category: "transport", paymentMethod: "other" },
  { date: "2026-10-02", type: "income", amount: 1500, category: "salary", paymentMethod: "cash" },
  { date: "2026-10-20", type: "expense", amount: 1000, category: "food", paymentMethod: "cash" },
  { date: "2026-11-01", type: "income", amount: 900, category: "salary", paymentMethod: "other" }
];
const wallet = { id: "cash", openingBalance: 10000 };

test("折れ線グラフは初期残高と現金だけで日末・月末の財布残高を計算する", () => {
  const daily = moneyTrendSeries(records, wallet, "2026-10", "day");
  assert.equal(daily.length, 31);
  assert.deepEqual([daily[0].balance, daily[1].balance, daily[19].balance, daily[20].balance], [8800, 9700, 8700, 8700]);
  const monthly = moneyTrendSeries(records, wallet, "2026-10", "month");
  assert.equal(monthly.length, 12);
  assert.equal(monthly[0].key, "2025-11");
  assert.deepEqual([monthly[0].balance, monthly.at(-2).balance, monthly.at(-1).balance], [9000, 8800, 8700]);
  const html = renderMoneyTrend(records, wallet, "2026-10", "day");
  assert.match(html, /2026-10-02 財布残高9,700円/);
  assert.match(html, /期間末の財布残高<\/span><strong>8,700円/);
  assert.doesNotMatch(html, /money-trend-line income|money-trend-line expense/);
});

test("円グラフは選択月の支出だけをカテゴリ別に分け、収入と別月を含めない", () => {
  const breakdown = expenseBreakdown(records, "2026-10");
  assert.deepEqual(breakdown.map(({ id, amount }) => [id, amount]), [["food", 1600], ["transport", 400]]);
  const html = renderExpenseDonut(records, "2026-10");
  assert.match(html, /支出合計 2,000円/);
  assert.match(html, /食費 1,600円/);
  assert.match(html, /80%/);
  assert.doesNotMatch(html, /2,200円|3,500円/);
});
