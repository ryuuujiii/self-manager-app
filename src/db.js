import { validateEvent, validateTodo } from "./domain.js?v=21";
import { validateFixedCost, validateTransaction, validateWallet } from "./money.js?v=21";
import { validateWorkplace, validateWorkShift } from "./work.js?v=21";
import { validateChecklist, validateHabit, validateHabitRecord, validateMemo, validateShoppingItem, validateWishlistItem } from "./life.js?v=21";
import { validateMoneyCategory } from "./money-categories.js?v=21";

const DB_NAME = "self-manager";
const DB_VERSION = 5;
const STORES_V2 = ["events", "todos", "wallets", "transactions", "fixedCosts"];
const STORES_V3 = [...STORES_V2, "workplaces", "workShifts"];
const LIFE_STORES = ["habits", "habitRecords", "checklists", "shoppingItems", "wishlistItems", "memos"];
const STORES_V4 = [...STORES_V3, ...LIFE_STORES];
const STORES = [...STORES_V4, "moneyCategories"];

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
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
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

export async function deleteHabit(db, id, records) {
  const transaction = db.transaction(["habits", "habitRecords"], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("habits").delete(id);
  for (const record of records) if (record.habitId === id) transaction.objectStore("habitRecords").delete(record.id);
  await done;
}

export async function putWishlistPurchase(db, wish, expense = null) {
  const transaction = db.transaction(expense ? ["wishlistItems", "transactions"] : ["wishlistItems"], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("wishlistItems").put(wish);
  if (expense) transaction.objectStore("transactions").put(expense);
  await done;
}

export async function exportBackup(db) {
  const records = await Promise.all(STORES.map((store) => getAll(db, store)));
  return { format: "self-manager-backup", version: 5, exportedAt: new Date().toISOString(), ...Object.fromEntries(STORES.map((store, index) => [store, records[index]])) };
}

export function validateBackup(value) {
  if (!value || value.format !== "self-manager-backup" || ![1, 2, 3, 4, 5].includes(value.version) || !Array.isArray(value.events) || !Array.isArray(value.todos)) throw new Error("このアプリのバックアップ形式ではありません。");
  if (value.version >= 2 && STORES_V2.slice(2).some((store) => !Array.isArray(value[store]))) throw new Error("お金のバックアップ形式が不正です。");
  if (value.version >= 3 && STORES_V3.slice(5).some((store) => !Array.isArray(value[store]))) throw new Error("仕事のバックアップ形式が不正です。");
  if (value.version >= 4 && LIFE_STORES.some((store) => !Array.isArray(value[store]))) throw new Error("生活のバックアップ形式が不正です。");
  if (value.version >= 5 && !Array.isArray(value.moneyCategories)) throw new Error("お金のカテゴリのバックアップ形式が不正です。");
  const names = value.version === 1 ? ["events", "todos"] : value.version === 2 ? STORES_V2 : value.version === 3 ? STORES_V3 : value.version === 4 ? STORES_V4 : STORES;
  const count = names.reduce((sum, store) => sum + value[store].length, 0);
  if (count > 30000 || value.wallets?.length > 1) throw new Error("バックアップの件数が多すぎます。");
  for (const item of value.events) if (typeof item.id !== "string" || validateEvent(item)) throw new Error("バックアップ内の予定データが不正です。");
  for (const item of value.todos) if (typeof item.id !== "string" || validateTodo(item)) throw new Error("バックアップ内のToDoデータが不正です。");
  if (value.version >= 5) {
    for (const item of value.moneyCategories) if (validateMoneyCategory(item)) throw new Error("バックアップ内のお金のカテゴリが不正です。");
    if (new Set(value.moneyCategories.map((item) => item.id)).size !== value.moneyCategories.length) throw new Error("バックアップ内のお金のカテゴリが重複しています。");
  }
  if (value.version >= 2) {
    for (const item of value.wallets) if (validateWallet(item)) throw new Error("バックアップ内の財布データが不正です。");
    for (const item of value.transactions) if (typeof item.id !== "string" || validateTransaction(item, value.moneyCategories || [])) throw new Error("バックアップ内の家計簿データが不正です。");
    for (const item of value.fixedCosts) if (typeof item.id !== "string" || validateFixedCost(item, value.moneyCategories || [])) throw new Error("バックアップ内の固定費データが不正です。");
  }
  if (value.version >= 3) {
    for (const item of value.workplaces) if (validateWorkplace(item)) throw new Error("バックアップ内の勤務先データが不正です。");
    for (const item of value.workShifts) if (validateWorkShift(item, value.workplaces)) throw new Error("バックアップ内のシフトデータが不正です。");
  }
  if (value.version >= 4) {
    for (const item of value.habits) if (validateHabit(item)) throw new Error("バックアップ内の習慣データが不正です。");
    for (const item of value.habitRecords) if (validateHabitRecord(item) || !value.habits.some((habit) => habit.id === item.habitId)) throw new Error("バックアップ内の習慣履歴が不正です。");
    for (const item of value.checklists) if (validateChecklist(item)) throw new Error("バックアップ内の持ち物データが不正です。");
    for (const item of value.shoppingItems) if (validateShoppingItem(item)) throw new Error("バックアップ内の買い物データが不正です。");
    for (const item of value.wishlistItems) if (validateWishlistItem(item)) throw new Error("バックアップ内のほしい物データが不正です。");
    for (const item of value.memos) if (validateMemo(item)) throw new Error("バックアップ内のメモデータが不正です。");
  }
  return value;
}

export function importBackup(db, data) {
  validateBackup(data);
  const names = data.version === 1 ? ["events", "todos"] : data.version === 2 ? STORES_V2 : data.version === 3 ? STORES_V3 : data.version === 4 ? STORES_V4 : STORES;
  const transaction = db.transaction(names, "readwrite");
  const done = transactionDone(transaction);
  for (const name of names) for (const record of data[name]) transaction.objectStore(name).put(record);
  return done;
}
