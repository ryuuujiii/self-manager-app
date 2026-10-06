import { CATEGORIES, eventsForDay, todosForDay } from "./domain.js?v=23";
import { holidayName } from "./jp-holidays.js?v=23";
import { fixedCostsForDay } from "./money.js?v=23";
import { shiftsForDay } from "./work.js?v=23";

export function calendarItemsForDay({ events, todos, workShifts, workplaces, fixedCosts }, key) {
  const holiday = holidayName(key);
  const workplaceNames = new Map(workplaces.map((item) => [item.id, item.name]));
  const items = [
    ...(holiday ? [{ kind: "holiday", title: holiday, color: "#c9475b" }] : []),
    ...eventsForDay(events, key).map((item) => ({
      kind: "event", title: item.title, color: CATEGORIES[item.category]?.color || CATEGORIES.other.color
    })),
    ...shiftsForDay(workShifts, key).map((item) => ({
      kind: "shift", title: workplaceNames.get(item.workplaceId) || "シフト", color: "#b26538"
    })),
    ...todosForDay(todos, key).map((item) => ({
      kind: item.completedAt ? "todo-done" : "todo", title: item.title,
      color: item.completedAt ? "#82968a" : "#aa5791"
    })),
    ...fixedCostsForDay(fixedCosts, key).map((item) => ({
      kind: "fixed", title: item.title, color: "#9a6bb5"
    }))
  ];
  return items;
}
