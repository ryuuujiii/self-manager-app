import test from "node:test";
import assert from "node:assert/strict";
import { addDays, dateKey, deleteRepeatingEventOccurrence, homeSummary, monthGrid, eventsForDay, todosForDay, remindersForWindow, validateEvent, validateTodo } from "../src/domain.js";
import { validateBackup } from "../src/db.js";

test("月間カレンダーは日曜始まり・土曜終わりで、閏日と前後月を含める", () => {
  const days = monthGrid(2028, 1);
  assert.equal(days[0], "2028-01-30");
  assert.equal(new Date(2028, 0, 30).getDay(), 0);
  assert.equal(new Date(...days.at(-1).split("-").map((value, index) => index === 1 ? Number(value) - 1 : Number(value))).getDay(), 6);
  assert.ok(days.includes("2028-02-29"));
  assert.equal(days.length % 7, 0);
});

test("日付の加減算は月末と年末をまたぐ", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
  assert.equal(dateKey(new Date(2026, 8, 27)), "2026-09-27");
});

test("予定とToDoは不正な日付と逆転した時刻を拒否する", () => {
  assert.match(validateEvent({ title: "会議", date: "2026-02-30", allDay: true, category: "work" }), /日付/);
  assert.match(validateEvent({ title: "会議", date: "2026-09-27", allDay: false, start: "15:00", end: "14:00", category: "work" }), /終了時刻/);
  assert.match(validateTodo({ title: "提出", dueDate: "", dueTime: "23:00", category: "university" }), /期限日/);
});

test("ホームには今日のToDoと未完了の期限超過を集める", () => {
  const events = [{ id: "e1", title: "予定", date: "2026-09-27", allDay: true }];
  const todos = [
    { id: "t1", title: "未完了", dueDate: "2026-09-27", completedAt: null },
    { id: "t2", title: "完了", dueDate: "2026-09-27", completedAt: "2026-09-27T01:00:00Z" },
    { id: "t3", title: "期限超過", dueDate: "2026-09-26", completedAt: null }
  ];
  const result = homeSummary(events, todos, "2026-09-27");
  assert.equal(result.todayEvents.length, 1);
  assert.equal(result.todayTodos.length, 2);
  assert.equal(result.overdueTodos.length, 1);
  assert.equal(result.openCount, 2);
});

test("バックアップは形式と内容を検証してから読み込む", () => {
  const valid = { format: "self-manager-backup", version: 1, events: [], todos: [] };
  assert.equal(validateBackup(valid), valid);
  assert.throws(() => validateBackup({ ...valid, events: [{ id: "x", title: "壊れた予定", date: "2026-02-30", allDay: true, category: "other" }] }), /予定データ/);
});

test("繰り返しは週ごと・月末補正で展開し、元データは増やさない", () => {
  const weekly = { id: "w", date: "2026-09-27", repeatRule: "weekly", allDay: true };
  assert.equal(eventsForDay([weekly], "2026-10-04").length, 1);
  assert.equal(eventsForDay([weekly], "2026-10-05").length, 0);
  const monthly = { id: "m", date: "2027-01-31", repeatRule: "monthly", allDay: true };
  assert.equal(eventsForDay([monthly], "2027-02-28").length, 1);
  assert.equal(eventsForDay([monthly], "2027-03-31").length, 1);
  assert.equal(eventsForDay([{ ...monthly, repeatUntil: "2027-02-28" }], "2027-03-31").length, 0);
});

test("繰り返し予定の指定日だけを除外しても前後の予定は残る", () => {
  const original = { id: "e", title: "授業", date: "2026-10-01", repeatRule: "weekly", allDay: true, category: "university" };
  const updated = deleteRepeatingEventOccurrence(original, "2026-10-08", "single");
  assert.deepEqual(updated.excludedDates, ["2026-10-08"]);
  assert.equal(eventsForDay([updated], "2026-10-01").length, 1);
  assert.equal(eventsForDay([updated], "2026-10-08").length, 0);
  assert.equal(eventsForDay([updated], "2026-10-15").length, 1);
  assert.equal(original.excludedDates, undefined);
  assert.equal(validateEvent(updated), null);
  assert.equal(validateBackup({ format: "self-manager-backup", version: 1, events: [updated], todos: [] }).events[0].excludedDates[0], "2026-10-08");
});

test("繰り返し予定の指定日以降を削除しても過去は残り、初回からなら全件削除になる", () => {
  const original = { id: "e", title: "家事", date: "2026-10-01", repeatRule: "daily", allDay: true, category: "life", excludedDates: ["2026-10-02", "2026-10-07"] };
  const updated = deleteRepeatingEventOccurrence(original, "2026-10-05", "future");
  assert.equal(updated.repeatUntil, "2026-10-04");
  assert.deepEqual(updated.excludedDates, ["2026-10-02"]);
  assert.equal(eventsForDay([updated], "2026-10-04").length, 1);
  assert.equal(eventsForDay([updated], "2026-10-05").length, 0);
  assert.equal(eventsForDay([original], "2026-10-05").length, 1);
  assert.equal(deleteRepeatingEventOccurrence(original, "2026-10-01", "future"), null);
  assert.match(validateEvent({ ...original, excludedDates: ["2026-02-30"] }), /除外日/);
});

test("繰り返すToDoは対象日だけ完了できる", () => {
  const todo = { id: "t", title: "習慣", dueDate: "2026-09-27", repeatRule: "daily", completedDates: ["2026-09-27"] };
  assert.ok(todosForDay([todo], "2026-09-27")[0].completedAt);
  assert.equal(todosForDay([todo], "2026-09-28")[0].completedAt, null);
  assert.deepEqual(todo.completedDates, ["2026-09-27"]);
});

test("リマインダーは設定項目だけを時刻順に導出する", () => {
  const now = new Date(2026, 8, 27, 8, 30);
  const events = [{ id: "e", title: "会議", date: "2026-09-27", start: "10:00", allDay: false, reminderLead: "oneHour" }];
  const todos = [{ id: "t", title: "提出", dueDate: "2026-09-27", dueTime: "09:00", reminderLead: "at", completedAt: null }];
  const items = remindersForWindow(events, todos, now);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.id), ["e", "t"]);
  assert.equal(items[0].triggerAt.getHours(), 9);
});

test("旧形式のバックアップと新しい設定の検証を両立する", () => {
  const legacy = { format: "self-manager-backup", version: 1, events: [{ id: "old", title: "旧予定", date: "2026-09-27", allDay: true, category: "private" }], todos: [] };
  assert.equal(validateBackup(legacy), legacy);
  assert.match(validateTodo({ title: "習慣", dueDate: "", category: "life", repeatRule: "daily" }), /日付/);
  assert.match(validateEvent({ title: "予定", date: "2026-09-27", allDay: true, category: "work", repeatRule: "yearly" }), /繰り返し/);
});
