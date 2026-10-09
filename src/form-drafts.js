// Drafts stay on this device, separate from saved records and JSON backups.
const STORAGE_KEY = "self-manager-form-drafts-v1";
export const EDITOR_FORMS = {
  editor: "editor-form", moneyEditor: "money-form", moneyCategoryEditor: "money-category-form",
  workEditor: "work-form", lifeEditor: "life-form", eventCategoryEditor: "event-category-form"
};
const CONTEXT_KEYS = ["tab", "page", "lifeMode", "activeChecklistId", "activeMemoFolderId", "habitMonth", "moneyMode", "moneyMonthInitialized", "workMonthInitialized", "moneyMonth", "moneySelectedDate", "workMode", "requestMonth", "requestSelectedDate", "requestMultiSelect", "requestSelectedDates", "workMonth", "workSelectedDate", "workWorkplaceId", "scheduleMode", "selectedDate", "year", "month"];

export function captureFields(form) {
  return Array.from(form.elements).filter((field) => field.name && !["file", "submit", "button", "password"].includes(field.type)).map((field) => ({
    name: field.name, type: field.type, value: field.value,
    checked: ["checkbox", "radio"].includes(field.type) ? field.checked : undefined
  }));
}

export function restoreFields(form, fields) {
  for (const saved of fields || []) {
    for (const field of Array.from(form.elements).filter((item) => item.name === saved.name && item.type === saved.type)) {
      if (["checkbox", "radio"].includes(field.type)) {
        if (field.value === saved.value) field.checked = saved.checked;
      } else field.value = saved.value;
    }
  }
}

export function createDraftController(storage, onError = () => {}) {
  let drafts = {};
  const keyFor = (editor) => `${editor.kind || "category"}:${editor.id || "new"}`;
  return {
    load(state) {
      try {
        const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
        if (!saved || saved.version !== 1 || !saved.editors || !saved.fields) return;
        drafts = saved.fields;
        for (const name of CONTEXT_KEYS) if (Object.hasOwn(saved.context || {}, name)) state[name] = saved.context[name];
        for (const name of Object.keys(EDITOR_FORMS)) state[name] = saved.editors[name] || null;
      } catch { onError(); }
    },
    capture(state, root) {
      for (const [name, formId] of Object.entries(EDITOR_FORMS)) {
        const editor = state[name];
        const form = root.querySelector(`#${formId}`);
        if (!editor) { delete drafts[name]; continue; }
        // A different editor must not receive the previous form's contents.
        if (form && (name.endsWith("CategoryEditor") || (form.dataset.kind || "category") === (editor.kind || "category")) && (form.dataset.id || "") === (editor.id || "")) {
          drafts[name] = { key: keyFor(editor), fields: captureFields(form) };
        }
      }
    },
    restore(state, root) {
      for (const [name, formId] of Object.entries(EDITOR_FORMS)) {
        const form = root.querySelector(`#${formId}`);
        if (form && state[name] && drafts[name]?.key === keyFor(state[name])) restoreFields(form, drafts[name].fields);
      }
    },
    persist(state) {
      try {
        const editors = Object.fromEntries(Object.keys(EDITOR_FORMS).filter((name) => state[name]).map((name) => [name, state[name]]));
        if (!Object.keys(editors).length) { storage.removeItem(STORAGE_KEY); return; }
        const context = Object.fromEntries(CONTEXT_KEYS.map((name) => [name, state[name]]));
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, context, editors, fields: drafts }));
      } catch { onError(); }
    }
  };
}
