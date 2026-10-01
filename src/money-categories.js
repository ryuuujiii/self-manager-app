export const MONEY_CATEGORIES = {
  food: "食費", transport: "交通", daily: "日用品", dining: "外食", leisure: "娯楽",
  housing: "住居", utilities: "光熱・通信", subscription: "サブスク", salary: "給与", other: "その他"
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
  subscription: "categoryRepeat", salary: "categorySalary", other: "categoryDots"
};

export function validateMoneyCategory(value) {
  if (!value || typeof value.id !== "string" || (!Object.hasOwn(MONEY_CATEGORIES, value.id) && !/^custom-[a-f0-9-]{36}$/.test(value.id))) return "カテゴリの識別子が不正です。";
  if (typeof value.label !== "string" || !value.label.trim() || value.label.trim().length > 24) return "カテゴリ名は24文字以内で入力してください。";
  if (!Object.hasOwn(MONEY_CATEGORY_ICONS, value.icon)) return "アイコンを選択してください。";
  return null;
}

export function moneyCategoryCatalog(saved = []) {
  const overrides = new Map(saved.map((item) => [item.id, item]));
  const builtins = Object.entries(MONEY_CATEGORIES).map(([id, label]) => ({ id, label, icon: overrides.get(id)?.icon || DEFAULT_ICONS[id], builtin: true }));
  const custom = saved.filter((item) => !Object.hasOwn(MONEY_CATEGORIES, item.id)).map((item) => ({ ...item, builtin: false }));
  return [...builtins, ...custom];
}

export function moneyCategoryById(id, saved = []) {
  return moneyCategoryCatalog(saved).find((item) => item.id === id) || { id: "other", label: MONEY_CATEGORIES.other, icon: DEFAULT_ICONS.other, builtin: true };
}

export function moneyCategoryExists(id, saved = []) {
  return Object.hasOwn(MONEY_CATEGORIES, id) || saved.some((item) => item.id === id && !validateMoneyCategory(item));
}
