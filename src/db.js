import { validateEvent, validateTodo } from "./domain.js?v=8";
import { validateFixedCost, validateTransaction, validateWallet } from "./money.js?v=8";
import { validateWorkplace, validateWorkShift } from "./work.js?v=8";

const DB_NAME = "self-manager";
const DB_VERSION = 3;
const STORES_V2 = ["events", "todos", "wallets", "transactions", "fixedCosts"];
const STORES = [...STORES_V2, "workplaces", "workShifts"];

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

export function exportBackup(db) {
  return Promise.all(STORES.map((store)=>getAll(db,store))).then(([events,todos,wallets,transactions,fixedCosts,workplaces,workShifts])=>({format:"self-manager-backup",version:3,exportedAt:new Date().toISOString(),events,todos,wallets,transactions,fixedCosts,workplaces,workShifts}));
}

export function validateBackup(value) {
  if(!value||value.format!=="self-manager-backup"||![1,2,3].includes(value.version)||!Array.isArray(value.events)||!Array.isArray(value.todos))throw new Error("このアプリのバックアップ形式ではありません。");
  if(value.version>=2&&(!Array.isArray(value.wallets)||!Array.isArray(value.transactions)||!Array.isArray(value.fixedCosts)))throw new Error("お金のバックアップ形式が不正です。");
  if(value.version===3&&(!Array.isArray(value.workplaces)||!Array.isArray(value.workShifts)))throw new Error("仕事のバックアップ形式が不正です。");
  const count=value.events.length+value.todos.length+(value.wallets?.length||0)+(value.transactions?.length||0)+(value.fixedCosts?.length||0)+(value.workplaces?.length||0)+(value.workShifts?.length||0);
  if(count>10000||value.wallets?.length>1)throw new Error("バックアップの件数が多すぎます。");
  for(const event of value.events)if(typeof event.id!=="string"||validateEvent(event))throw new Error("バックアップ内の予定データが不正です。");
  for(const todo of value.todos)if(typeof todo.id!=="string"||validateTodo(todo))throw new Error("バックアップ内のToDoデータが不正です。");
  if(value.version>=2){
    for(const wallet of value.wallets)if(validateWallet(wallet))throw new Error("バックアップ内の財布データが不正です。");
    for(const item of value.transactions)if(typeof item.id!=="string"||validateTransaction(item))throw new Error("バックアップ内の家計簿データが不正です。");
    for(const item of value.fixedCosts)if(typeof item.id!=="string"||validateFixedCost(item))throw new Error("バックアップ内の固定費データが不正です。");
  }
  if(value.version===3){
    for(const workplace of value.workplaces)if(validateWorkplace(workplace))throw new Error("バックアップ内の勤務先データが不正です。");
    for(const shift of value.workShifts)if(validateWorkShift(shift,value.workplaces))throw new Error("バックアップ内のシフトデータが不正です。");
  }
  return value;
}

export function importBackup(db,data) {
  validateBackup(data);
  const names=data.version===1?["events","todos"]:data.version===2?STORES_V2:STORES;
  const transaction=db.transaction(names,"readwrite");
  const done=transactionDone(transaction);
  for(const name of names)for(const record of (data[name]||[]))transaction.objectStore(name).put(record);
  return done;
}
