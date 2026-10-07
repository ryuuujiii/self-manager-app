import test from "node:test";
import assert from "node:assert/strict";
import { holidayName } from "../src/jp-holidays.js";
import { calendarItemsForDay } from "../src/schedule-calendar.js";

test("予定カレンダーに祝日名と登録済みの予定・シフト・ToDoを同じ日へ集める", () => {
  const items = calendarItemsForDay({
    events: [{ id: "event", title: "大学の面談", date: "2026-10-12", allDay: true, category: "university" }],
    workShifts: [{ id: "shift", workplaceId: "shop", date: "2026-10-12", start: "15:00", end: "20:00" }],
    workplaces: [{ id: "shop", name: "テスト勤務先" }],
    todos: [{ id: "todo", title: "提出物", dueDate: "2026-10-12", category: "study" }],
    fixedCosts: []
  }, "2026-10-12");
  assert.deepEqual(items.map((item) => [item.kind, item.title]), [
    ["holiday", "スポーツの日"], ["event", "大学の面談"],
    ["shift", "テスト勤務先"], ["todo", "提出物"]
  ]);
});

test("公式祝日には国民の休日・振替休日を含め、平日には祝日名を付けない", () => {
  assert.equal(holidayName("2026-09-22"), "国民の休日");
  assert.equal(holidayName("2027-03-22"), "振替休日");
  assert.equal(holidayName("2026-10-13"), null);
});
