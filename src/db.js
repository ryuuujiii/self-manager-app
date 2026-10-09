import { requestConversion, validateShiftRequest, validateRequestBatch } from "./shift-requests.js?v=29";
import { validateEventCategory } from "./event-categories.js?v=29";
import { validateEvent, validateTodo } from "./domain.js?v=29";
import { validateFixedCost, validateTransaction, validateWallet } from "./money.js?v=29";
import { validateWorkplace, validateWorkShift } from "./work.js?v=29";
import { validateChecklist, validateHabit, validateHabitRecord, validateMemo, validateMemoFolder, validateShoppingItem, validateWishlistItem } from "./life.js?v=29";
import { validateMoneyCategory } from "./money-categories.js?v=29";

const DB_NAME = "self-manager";
const DB_VERSION = 7;
const STORES_V2 = ["events", "todos", "wallets", "transactions", "fixedCosts"];
const STORES_V3 = [...STORES_V2, "workplaces", "workShifts"];
const LIFE_STORES = ["habits", "habitRecords", "checklists", "shoppingItems", "wishlistItems", "memos"];
const STORES_V4 = [...STORES_V3, ...LIFE_STORES];
const STORES_V5 = [...STORES_V4, "moneyCategories"];
const STORES_V6 = [...STORES_V5, "eventCategories", "memoFolders"];
const STORES = [...STORES_V6, "shiftRequests"];

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
  return { format: "self-manager-backup", version: 7, exportedAt: new Date().toISOString(), ...Object.fromEntries(STORES.map((store, index) => [store, records[index]])) };
}

export function validateBackup(value) {
  if (!value || value.format !== "self-manager-backup" || ![1, 2, 3, 4, 5, 6, 7].includes(value.version) || !Array.isArray(value.events) || !Array.isArray(value.todos)) throw new Error("このアプリのバックアップ形式ではありません。");
  if (value.version >= 2 && STORES_V2.slice(2).some((store) => !Array.isArray(value[store]))) throw new Error("お金のバックアップ形式が不正です。");
  if (value.version >= 3 && STORES_V3.slice(5).some((store) => !Array.isArray(value[store]))) throw new Error("仕事のバックアップ形式が不正です。");
  if (value.version >= 4 && LIFE_STORES.some((store) => !Array.isArray(value[store]))) throw new Error("生活のバックアップ形式が不正です。");
  if (value.version >= 5 && !Array.isArray(value.moneyCategories)) throw new Error("お金のカテゴリのバックアップ形式が不正です。");
  if (value.version >= 6) {
    if (!Array.isArray(value.eventCategories) || !Array.isArray(value.memoFolders)) throw new Error("予定カテゴリ・メモフォルダの形式が不正です。");
    for (const item of value.eventCategories) if (validateEventCategory(item)) throw new Error("予定カテゴリが不正です。");
    for (const item of value.memoFolders) if (validateMemoFolder(item)) throw new Error("メモフォルダが不正です。");
    for (const name of ["eventCategories", "memoFolders"]) if (new Set(value[name].map((item) => item.id)).size !== value[name].length) throw new Error("カテゴリ・フォルダのIDが重複しています。");
    for (const item of value.memos) if (item.folderId && !value.memoFolders.some((folder) => folder.id === item.folderId)) throw new Error("メモのフォルダが見つかりません。");
  }
  if (value.version >= 7) {
    if (!Array.isArray(value.shiftRequests)) throw new Error("シフト希望のバックアップ形式が不正です。");
    for (const item of value.shiftRequests) if (validateShiftRequest(item, value.workplaces)) throw new Error("シフト希望のデータが不正です。");
    if (new Set(value.shiftRequests.map((item) => item.id)).size !== value.shiftRequests.length) throw new Error("シフト希望が重複しています。");
  }
  const names = value.version === 1 ? ["events", "todos"] : value.version === 2 ? STORES_V2 : value.version === 3 ? STORES_V3 : value.version === 4 ? STORES_V4 : value.version === 5 ? STORES_V5 : value.version === 6 ? STORES_V6 : STORES;
  const count = names.reduce((sum, store) => sum + value[store].length, 0);
  if (count > 30000 || value.wallets?.length > 1) throw new Error("バックアップの件数が多すぎます。");
  for (const item of value.events) if (typeof item.id !== "string" || validateEvent(item, value.eventCategories || [])) throw new Error("バックアップ内の予定データが不正です。");
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
  const names = data.version === 1 ? ["events", "todos"] : data.version === 2 ? STORES_V2 : data.version === 3 ? STORES_V3 : data.version === 4 ? STORES_V4 : data.version === 5 ? STORES_V5 : data.version === 6 ? STORES_V6 : STORES;
  const transaction = db.transaction(names, "readwrite");
  const done = transactionDone(transaction);
  for (const name of names) for (const record of data[name]) transaction.objectStore(name).put(record);
  return done;
}

// Read and add in one transaction so retries and other tabs cannot duplicate shifts.
export async function confirmShiftRequests(db, workplaceId, start, end) {
  const tx = db.transaction(["shiftRequests", "workShifts", "workplaces"], "readwrite");
  const done = transactionDone(tx);
  const [requests, shifts, workplaces] = await Promise.all(["shiftRequests", "workShifts", "workplaces"].map((store) => requestResult(tx.objectStore(store).getAll())));
  const result = requestConversion(requests, shifts, workplaceId, start, end);
  for (const shift of result.additions) {
    const error = validateWorkShift(shift, workplaces);
    if (error) { tx.abort(); await done.catch(() => {}); throw new Error(error); }
    tx.objectStore("workShifts").put(shift);
  }
  await done;
  return result;
}

// Validate and write all selected days together. Failed saves leave every day unchanged.
export async function saveShiftRequestBatch(db, records, { overwrite = false, period } = {}) {
  const tx = db.transaction(["shiftRequests", "workplaces"], "readwrite");
  const done = transactionDone(tx);
  const [existing, workplaces] = await Promise.all(["shiftRequests", "workplaces"].map((store) => requestResult(tx.objectStore(store).getAll())));
  const error = validateRequestBatch(records, workplaces, period);
  if (error) { tx.abort(); await done.catch(() => {}); throw new Error(error); }
  const replacements = records.filter((record) => existing.some((item) => item.id === record.id));
  if (replacements.length && !overwrite) { await done; return { replacements, saved: false }; }
  for (const record of records) {
    const previous = existing.find((item) => item.id === record.id);
    tx.objectStore("shiftRequests").put({ ...record, createdAt: previous?.createdAt || record.createdAt });
  }
  await done;
  return { replacements, saved: true };
}
