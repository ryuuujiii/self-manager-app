export const MONEY_CATEGORIES = {
  food: "食費", transport: "交通", daily: "日用品", dining: "外食", leisure: "娯楽",
  housing: "住居", utilities: "光熱・通信", subscription: "サブスク", other: "その他",
  salary: "給与", sideIncome: "臨時収入", refund: "返金", incomeOther: "その他"
};

export const MONEY_CATEGORY_ICONS = {
  categoryFood: "食べ物", categoryTransport: "交通", categoryBag: "買い物", categoryDining: "外食",
  categoryLeisure: "娯楽", categoryHouse: "住まい", categoryBolt: "光熱費", categoryRepeat: "定期支払い",
  categorySalary: "お金", categoryDots: "その他", categoryBook: "学び", categoryHeart: "好きなもの",
  categoryGift: "贈り物", categoryHealth: "健康"
};

const DEFAULT_ICONS = {
  food: "categoryFood", transport: "categoryTransport", daily: "categoryBag", dining: "categoryDining",
  leisure: "categoryLeisure", housing: "categoryHouse", utilities: "categoryBolt",
  subscription: "categoryRepeat", other: "categoryDots", salary: "categorySalary",
  sideIncome: "categoryGift", refund: "categoryRepeat", incomeOther: "categoryDots"
};

const INCOME_CATEGORIES = new Set(["salary", "sideIncome", "refund", "incomeOther"]);
const builtinKind = (id) => INCOME_CATEGORIES.has(id) ? "income" : "expense";

export function validateMoneyCategory(value) {
  if (!value || typeof value.id !== "string" || (!Object.hasOwn(MONEY_CATEGORIES, value.id) && !/^custom-[a-f0-9-]{36}$/.test(value.id))) return "カテゴリの識別子が不正です。";
  if (typeof value.label !== "string" || !value.label.trim() || value.label.trim().length > 24) return "カテゴリ名は24文字以内で入力してください。";
  if (!Object.hasOwn(MONEY_CATEGORY_ICONS, value.icon)) return "アイコンを選択してください。";
  if (value.kind != null && !["expense", "income"].includes(value.kind)) return "カテゴリの種類を選択してください。";
  if (Object.hasOwn(MONEY_CATEGORIES, value.id) && value.kind != null && value.kind !== builtinKind(value.id)) return "標準カテゴリの種類は変更できません。";
  return null;
}

export function moneyCategoryCatalog(saved = [], kind = null) {
  const overrides = new Map(saved.map((item) => [item.id, item]));
  const builtins = Object.entries(MONEY_CATEGORIES).map(([id, label]) => ({ id, label, icon: overrides.get(id)?.icon || DEFAULT_ICONS[id], kind: builtinKind(id), builtin: true }));
  const custom = saved.filter((item) => !Object.hasOwn(MONEY_CATEGORIES, item.id)).map((item) => ({ ...item, kind: item.kind || "both", builtin: false }));
  return [...builtins, ...custom].filter((item) => !kind || item.kind === kind || item.kind === "both");
}

export function resolveMoneyCategories(saved = [], transactions = [], fixedCosts = []) {
  return saved.map((item) => {
    if (item.kind || Object.hasOwn(MONEY_CATEGORIES, item.id)) return item;
    const kinds = new Set(transactions.filter((record) => record.category === item.id).map((record) => record.type));
    if (fixedCosts.some((record) => record.category === item.id)) kinds.add("expense");
    return { ...item, kind: kinds.size === 2 ? "both" : kinds.has("income") ? "income" : "expense" };
  });
}

export function moneyCategoryById(id, saved = []) {
  return moneyCategoryCatalog(saved).find((item) => item.id === id) || { id: "other", label: MONEY_CATEGORIES.other, icon: DEFAULT_ICONS.other, kind: "expense", builtin: true };
}

export function moneyCategoryExists(id, saved = []) {
  return Object.hasOwn(MONEY_CATEGORIES, id) || saved.some((item) => item.id === id && !validateMoneyCategory(item));
}
