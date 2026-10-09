import { eventCategoryById } from "./event-categories.js?v=29";
import { eventsForDay, todosForDay } from "./domain.js?v=29";
import { holidayName } from "./jp-holidays.js?v=29";
import { shiftsForDay } from "./work.js?v=29";

export function calendarItemsForDay({ events, todos, workShifts, workplaces, eventCategories = [] }, key) {
  const holiday = holidayName(key);
  const workplaceNames = new Map(workplaces.map((item) => [item.id, item.name]));
  const items = [
    ...(holiday ? [{ kind: "holiday", title: holiday, color: "#c9475b" }] : []),
    ...eventsForDay(events, key).map((item) => ({
      kind: "event", title: item.title, color: eventCategoryById(item.category, eventCategories, events).color
    })),
    ...shiftsForDay(workShifts, key).map((item) => ({
      kind: "shift", title: workplaceNames.get(item.workplaceId) || "シフト", color: "#b26538"
    })),
    ...todosForDay(todos, key).map((item) => ({
      kind: item.completedAt ? "todo-done" : "todo", title: item.title,
      color: item.completedAt ? "#82968a" : "#aa5791"
    }))
  ];
  return items;
}
