import { validateEvent, validateTodo } from "./domain.js";

const DB_NAME = "self-manager";
const DB_VERSION = 1;
const STORES = ["events", "todos"];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("保存を完了できませんでした。"));
  });
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("別のタブでアプリが開かれています。閉じてから再試行してください。"));
  });
}

export async function getAll(db, store) {
  if (!STORES.includes(store)) throw new Error("保存先が不正です。");
  return requestResult(db.transaction(store, "readonly").objectStore(store).getAll());
}

export async function putRecord(db, store, record) {
  if (!STORES.includes(store)) throw new Error("保存先が不正です。");
  const transaction = db.transaction(store, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(store).put(record);
  await done;
}

export async function deleteRecord(db, store, id) {
  if (!STORES.includes(store)) throw new Error("保存先が不正です。");
  const transaction = db.transaction(store, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(store).delete(id);
  await done;
}

export async function exportBackup(db) {
  const [events, todos] = await Promise.all(STORES.map((store) => getAll(db, store)));
  return { format: "self-manager-backup", version: 1, exportedAt: new Date().toISOString(), events, todos };
}

export function validateBackup(value) {
  if (!value || value.format !== "self-manager-backup" || value.version !== 1 || !Array.isArray(value.events) || !Array.isArray(value.todos)) {
    throw new Error("このアプリのバックアップ形式ではありません。");
  }
  if (value.events.length + value.todos.length > 10000) throw new Error("バックアップの件数が多すぎます。");
  for (const event of value.events) {
    if (typeof event.id !== "string" || validateEvent(event)) throw new Error("バックアップ内の予定データが不正です。");
  }
  for (const todo of value.todos) {
    if (typeof todo.id !== "string" || validateTodo(todo)) throw new Error("バックアップ内のToDoデータが不正です。");
  }
  return value;
}

export async function importBackup(db, data) {
  validateBackup(data);
  const transaction = db.transaction(STORES, "readwrite");
  const done = transactionDone(transaction);
  for (const event of data.events) transaction.objectStore("events").put(event);
  for (const todo of data.todos) transaction.objectStore("todos").put(todo);
  await done;
}
