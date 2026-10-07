import test from "node:test";
import assert from "node:assert/strict";
import { nextShift, shiftMinutes, shiftPatterns, shiftPay, shiftsForDay, validateWorkplace, validateWorkShift, workPeriod, workPeriodForDate, workPeriodSummary, workSummary } from "../src/work.js";
import { validateBackup } from "../src/db.js";
import { renderWorkEditor, renderWorkScreen } from "../src/work-ui.js";

const cafe = { id: "cafe", name: "カフェ", hourlyWage: 1100, payday: 25, location: "新宿", note: "" };
const shop = { id: "shop", name: "スーパー", hourlyWage: 800, payday: 5, location: "テスト駅前", note: "" };
const shift = (id, workplaceId, date, start, end, breakMinutes = 0) => ({ id, workplaceId, date, start, end, breakMinutes, note: "" });

test("勤務先を参照して複数のシフトから勤務時間と給料見込みを計算する", () => {
  const shifts = [shift("a", "cafe", "2026-09-25", "16:00", "21:00", 30), shift("b", "shop", "2026-09-26", "15:00", "20:00")];
  assert.equal(validateWorkplace(cafe), null);
  assert.equal(validateWorkShift(shifts[0], [cafe, shop]), null);
  assert.equal(shiftMinutes(shifts[0]), 270);
  assert.equal(shiftPay(shifts[0], cafe), 4950);
  assert.deepEqual(workSummary(shifts, [cafe, shop], "2026-09"), { count: 2, shiftCount: 2, minutes: 570, pay: 8950, shifts });
  assert.equal(workSummary([shifts[0], { ...shifts[1], date: "2026-09-25" }], [cafe, shop], "2026-09").count, 1);
  assert.deepEqual(shiftsForDay(shifts, "2026-09-26"), [shifts[1]]);
  assert.equal(shiftPay(shifts[0], { ...cafe, hourlyWage: 1200 }), 5400);
});

test("交通費は勤務先ごとに1日分だけ給料見込みへ加算する", () => {
  const place = { ...shop, transportPerDay: 500, closingDay: 20 };
  const shifts = [
    shift("a", "shop", "2026-09-21", "09:00", "12:00"),
    shift("b", "shop", "2026-09-21", "13:00", "16:00"),
    shift("c", "shop", "2026-09-22", "09:00", "12:00")
  ];
  const summary = workPeriodSummary(shifts, place, "2026-09");
  assert.deepEqual([summary.count, summary.wagePay, summary.transportPay, summary.pay], [2, 7200, 1000, 8200]);
  assert.equal(workSummary(shifts, [place], "2026-09").pay, 8200);
  assert.equal(validateWorkplace(place), null);
  assert.match(validateWorkplace({ ...place, transportPerDay: -1 }), /交通費/);
  assert.match(validateWorkplace({ ...place, transportPerDay: 1.5 }), /交通費/);
  assert.match(renderWorkEditor({ kind: "workplace", id: "shop" }, { workplaces: [place], shifts }), /name="transportPerDay"[^>]*value="500"/);
  assert.match(renderWorkScreen({ mode: "month", month: "2026-09", selectedDate: "2026-09-21", workplaceId: "shop", workplaces: [place], shifts }), /交通費 1,000円（2日）/);
  const backup = { format: "self-manager-backup", version: 3, events: [], todos: [], wallets: [], transactions: [], fixedCosts: [], workplaces: [place], workShifts: shifts };
  assert.equal(validateBackup(backup), backup);
});

test("日付をまたぐシフトと次の勤務を扱い、不正な休憩・参照を拒否する", () => {
  const late = shift("late", "cafe", "2026-09-27", "22:00", "02:00", 30);
  assert.equal(shiftMinutes(late), 210);
  assert.equal(validateWorkShift(late, [cafe]), null);
  assert.equal(nextShift([late], new Date(2026, 8, 28, 1, 0))?.id, "late");
  assert.match(validateWorkShift({ ...late, breakMinutes: 240 }, [cafe]), /休憩/);
  assert.match(validateWorkShift({ ...late, workplaceId: "missing" }, [cafe]), /勤務先/);
});

test("仕事のバックアップv3を検証し、旧v2も受け入れる", () => {
  const backup = { format: "self-manager-backup", version: 3, events: [], todos: [], wallets: [], transactions: [], fixedCosts: [], workplaces: [cafe], workShifts: [shift("a", "cafe", "2026-09-25", "16:00", "21:00")] };
  assert.equal(validateBackup(backup), backup);
  assert.throws(() => validateBackup({ ...backup, workplaces: [] }), /シフト/);
  assert.throws(() => validateBackup({ ...backup, workShifts: undefined }), /仕事/);
  assert.equal(validateBackup({ ...backup, version: 2, workplaces: undefined, workShifts: undefined }).version, 2);
});

test("仕事画面はシフトを一度だけ保存したまま月表示と一覧を組み立てる", () => {
  const data = { mode: "month", month: "2026-09", selectedDate: "2026-09-26", workplaces: [shop], shifts: [shift("s", "shop", "2026-09-26", "15:00", "20:00")] };
  const html = renderWorkScreen(data);
  assert.match(html, /4,000円/);
  assert.match(html, /スーパー/);
  assert.match(html, /2026-09-26 シフト1件/);
  assert.match(renderWorkScreen({ ...data, mode: "list" }), /リスト/);
});

test("仕事のカレンダーに開始・終了時刻を表示し、同日の追加シフト件数も分かる", () => {
  const shifts = [
    shift("late", "shop", "2026-09-26", "18:00", "21:00"),
    shift("early", "shop", "2026-09-26", "09:00", "12:00")
  ];
  const html = renderWorkScreen({ mode: "month", month: "2026-09", selectedDate: "2026-09-26", workplaceId: "shop", workplaces: [shop], shifts });
  assert.match(html, /data-date="2026-09-26"[^>]*aria-label="2026-09-26 シフト2件 09:00〜12:00、18:00〜21:00"/);
  assert.match(html, /class="work-cell-time"><span>09:00–<\/span><span>12:00<\/span><\/span><span class="work-cell-more">ほか1件<\/span>/);
  assert.match(html, /18:00〜21:00/);
});

test("勤務先ごとの締め期間で集計し、その給料日を示す", () => {
  const place = { ...shop, closingDay: 5, payday: 25, holidayShift: "previous" };
  const period = workPeriod("2026-09", place);
  assert.deepEqual([period.start, period.end, period.payday.actual], ["2026-09-06", "2026-10-05", "2026-10-23"]);
  assert.equal(workPeriodForDate("2026-10-05", place), "2026-09");
  assert.equal(workPeriodForDate("2026-10-06", place), "2026-10");
  const shifts = [shift("in", "shop", "2026-10-03", "15:00", "20:00"), shift("out", "shop", "2026-10-06", "15:00", "20:00")];
  assert.equal(workPeriodSummary(shifts, place, "2026-09").pay, 4000);
  const html = renderWorkScreen({ mode: "month", month: "2026-09", selectedDate: "2026-10-03", workplaceId: "shop", workplaces: [place], shifts });
  assert.match(html, /10月23日の給料見込み/);
  assert.match(html, /9月6日〜10月5日/);
  assert.match(html, /data-date="2026-10-01"[^>]*><span>10\/1<\/span>/);
  assert.match(html, /<span>日<\/span><span>月<\/span>/);
  assert.doesNotMatch(html, /data-id="out"/);
});

test("31日締めは短い月の末日に丸め、勤務先ごとの支払月設定を使う", () => {
  const place = { ...cafe, closingDay: 31, payday: 5, payMonthOffset: 1, holidayShift: "next" };
  const period = workPeriod("2026-02", place);
  assert.deepEqual([period.start, period.end, period.payday.actual], ["2026-03-01", "2026-03-31", "2026-04-06"]);
  assert.equal(workPeriodForDate("2026-03-31", place), "2026-02");
  assert.equal(workPeriodForDate("2026-04-01", place), "2026-03");
  const automatic = workPeriod("2026-09", { ...place, payday: 1, payMonthOffset: null, holidayShift: "previous" });
  assert.deepEqual([automatic.start, automatic.end, automatic.payday.actual], ["2026-10-01", "2026-10-31", "2026-12-01"]);
});

test("20日締めの9月21日〜10月20日分は11月5日の給料見込みになる", () => {
  const place = { ...shop, closingDay: 20, payday: 5, payMonthOffset: null };
  const shifts = [
    shift("before", "shop", "2026-09-20", "15:00", "20:00"),
    shift("start", "shop", "2026-09-21", "15:00", "20:00"),
    shift("end", "shop", "2026-10-20", "15:00", "20:00"),
    shift("after", "shop", "2026-10-21", "15:00", "20:00")
  ];
  const summary = workPeriodSummary(shifts, place, "2026-09");
  assert.deepEqual([summary.start, summary.end, summary.payday.actual, summary.pay], ["2026-09-21", "2026-10-20", "2026-11-05", 8000]);
  assert.equal(workPeriodForDate("2026-09-20", place), "2026-08");
  assert.equal(workPeriodForDate("2026-09-21", place), "2026-09");
  assert.equal(workPeriodForDate("2026-10-20", place), "2026-09");
  assert.equal(workPeriodForDate("2026-10-21", place), "2026-10");
  const html = renderWorkScreen({ mode: "month", month: "2026-09", selectedDate: "2026-10-20", workplaceId: "shop", workplaces: [place], shifts });
  assert.match(html, /11月5日の給料見込み/);
  assert.match(html, /9月21日〜10月20日/);
  assert.doesNotMatch(html, /data-id="before"|data-id="after"/);
  assert.match(renderWorkEditor({ kind: "workplace", id: "shop" }, { workplaces: [place], shifts }), /9\/21〜10\/20の勤務分は11\/5/);
});

test("過去の勤務先・時間帯・休憩を組にして候補を作り、日付指定時は日付入力を開かない", () => {
  const shifts = [shift("a", "shop", "2026-09-01", "15:00", "20:00"), shift("b", "shop", "2026-09-08", "15:00", "20:00"), shift("c", "cafe", "2026-09-09", "16:00", "21:00", 30)];
  const patterns = shiftPatterns(shifts, [shop, cafe]);
  assert.deepEqual([patterns[0].workplaceId, patterns[0].start, patterns[0].end, patterns[0].count], ["shop", "15:00", "20:00", 2]);
  const data = { selectedDate: "2026-09-26", workplaceId: "shop", workplaces: [shop, cafe], shifts };
  const html = renderWorkEditor({ kind: "shift", id: null, lockDate: true }, data);
  assert.match(html, /過去のシフトから選ぶ/);
  assert.match(html, /data-workplace-id="shop" data-start="15:00" data-end="20:00"/);
  assert.match(html, /name="date" type="hidden" value="2026-09-26"/);
  assert.doesNotMatch(html, /name="date" type="date"/);
  assert.match(renderWorkEditor({ kind: "shift", id: null }, { ...data, shifts: [] }), /name="date" type="date"/);
});
