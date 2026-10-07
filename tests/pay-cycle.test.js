import assert from "node:assert/strict";
import test from "node:test";
import { adjustToBusinessDay, holidayInfo, isBusinessDay } from "../src/jp-holidays.js";
import { payPeriod, payPeriodForDate, paydayForMonth, periodGrid, periodSummary } from "../src/pay-cycle.js";
import { validateWallet } from "../src/money.js";
import { renderMoneyEditor, renderWallet } from "../src/money-ui.js";

test("内閣府の祝日・振替休日・国民の休日と連休を避ける", () => {
  assert.equal(holidayInfo("2026-09-22").holiday, true);
  assert.equal(holidayInfo("2027-03-22").holiday, true);
  assert.equal(isBusinessDay("2026-09-23"), false);
  assert.equal(adjustToBusinessDay("2026-09-23", "previous"), "2026-09-18");
  assert.equal(adjustToBusinessDay("2026-09-23", "next"), "2026-09-24");
  assert.equal(holidayInfo("2028-09-22").confirmed, false);
});

test("前の平日・後の平日を選ぶと給料日と締切日が変わる", () => {
  const previous = { salaryDay: 5, holidayShift: "previous" };
  const next = { salaryDay: 5, holidayShift: "next" };
  assert.deepEqual(paydayForMonth("2026-09", previous), { nominal: "2026-09-05", actual: "2026-09-04" });
  assert.deepEqual(paydayForMonth("2026-09", next), { nominal: "2026-09-05", actual: "2026-09-07" });
  assert.deepEqual([payPeriod("2026-08", previous).start, payPeriod("2026-08", previous).end], ["2026-08-05", "2026-09-03"]);
  assert.deepEqual([payPeriod("2026-08", next).start, payPeriod("2026-08", next).end], ["2026-08-05", "2026-09-06"]);
  assert.equal(payPeriodForDate("2026-09-03", previous), "2026-08");
  assert.equal(payPeriodForDate("2026-09-04", previous), "2026-09");
  assert.equal(payPeriodForDate("2026-09-06", next), "2026-08");
  assert.equal(payPeriodForDate("2026-09-07", next), "2026-09");
});

test("31日指定は月末へ補正し、表示と集計は期間内の現金だけを使う", () => {
  assert.equal(paydayForMonth("2026-02", { salaryDay: 31, holidayShift: "previous" }).actual, "2026-02-27");
  const period = payPeriod("2026-08", { salaryDay: 5, holidayShift: "previous" });
  const grid = periodGrid(period.start, period.end);
  assert.equal(grid[0], "2026-08-02");
  assert.equal(grid.at(-1), "2026-09-05");
  const cash = [
    { id: "a", date: "2026-08-05", type: "income", amount: 5000, paymentMethod: "cash", category: "other", createdAt: "1" },
    { id: "b", date: "2026-09-03", type: "expense", amount: 600, paymentMethod: "cash", category: "food", createdAt: "2" },
    { id: "c", date: "2026-09-04", type: "expense", amount: 1000, paymentMethod: "cash", category: "food", createdAt: "3" }
  ];
  assert.equal(periodSummary(cash, period.start, period.end).net, 4400);
  const html = renderWallet({ wallet: { id: "cash", openingBalance: 0, salaryDay: 5, holidayShift: "previous" }, transactions: cash, month: "2026-08", selectedDate: null });
  assert.match(html, /8月5日〜9月3日/);
  assert.match(html, /締切 9月3日/);
  assert.match(html, /次の給料日 9月4日/);
  assert.match(html, /data-date="2026-09-01"[^>]*>\s*<span class="ledger-date">9\/1<\/span>/);
  assert.match(html, /data-id="a"/);
  assert.match(html, /data-id="b"/);
  assert.doesNotMatch(html, /data-id="c"/);
});

test("古い財布データを維持しつつ給料日設定を検証する", () => {
  assert.equal(validateWallet({ id: "cash", openingBalance: 0 }), null);
  assert.equal(validateWallet({ id: "cash", openingBalance: 0, salaryDay: 25, holidayShift: "next" }), null);
  assert.match(validateWallet({ id: "cash", openingBalance: 0, salaryDay: 0 }), /給料日/);
  assert.match(validateWallet({ id: "cash", openingBalance: 0, salaryDay: 25, holidayShift: "invalid" }), /調整方法/);
  const html = renderMoneyEditor({ kind: "payday", id: null }, { wallet: { id: "cash", openingBalance: 1000, salaryDay: 5, holidayShift: "next" }, transactions: [], fixedCosts: [] });
  assert.match(html, /name="salaryDay"/);
  assert.match(html, /value="5"/);
  assert.match(html, /value="next" selected/);
});
