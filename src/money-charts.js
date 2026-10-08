import { moneyCategoryById } from "./money-categories.js?v=27";

const formatYen = (value) => `${new Intl.NumberFormat("ja-JP").format(value)}円`;
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function moneyTrendSeries(transactions, wallet, month, interval = "day") {
  const [year, monthNumber] = month.split("-").map(Number);
  const buckets = interval === "month"
    ? Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, monthNumber - 12 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: `${date.getMonth() + 1}月`, balance: 0 };
    })
    : Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, index) => {
      const day = index + 1;
      return { key: `${month}-${String(day).padStart(2, "0")}`, label: `${day}日`, balance: 0 };
    });
  const changes = new Map(buckets.map((bucket) => [bucket.key, 0]));
  let balance = wallet?.openingBalance || 0;
  for (const item of transactions) {
    if (item.paymentMethod !== "cash") continue;
    const key = interval === "month" ? item.date.slice(0, 7) : item.date;
    const change = item.type === "income" ? item.amount : -item.amount;
    if (key < buckets[0].key) balance += change;
    else if (changes.has(key)) changes.set(key, changes.get(key) + change);
  }
  for (const bucket of buckets) {
    balance += changes.get(bucket.key);
    bucket.balance = balance;
  }
  return buckets;
}

export function expenseBreakdown(transactions, month, categories = []) {
  const totals = new Map();
  for (const item of transactions) {
    if (item.type !== "expense" || !item.date.startsWith(`${month}-`)) continue;
    totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  }
  return [...totals].map(([id, amount]) => ({ ...moneyCategoryById(id, categories), amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function renderMoneyTrend(transactions, wallet, month, interval = "day") {
  const points = moneyTrendSeries(transactions, wallet, month, interval);
  const balances = points.map((point) => point.balance);
  const smallest = Math.min(...balances), largest = Math.max(...balances);
  const padding = smallest === largest ? Math.max(100, Math.abs(smallest) * 0.05) : (largest - smallest) * 0.15;
  const lower = smallest - padding, upper = largest + padding;
  const left = 10, right = 350, top = 14, bottom = 142;
  const x = (index) => left + index * (right - left) / Math.max(1, points.length - 1);
  const y = (value) => bottom - (value - lower) / (upper - lower) * (bottom - top);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point.balance).toFixed(1)}`).join(" ");
  const labels = points.filter((_, index) => interval === "month" ? index % 3 === 0 || index === points.length - 1 : index === 0 || index % 5 === 4 || index === points.length - 1);
  const description = points.map((point) => `${point.key} 財布残高${formatYen(point.balance)}`).join("、");
  const last = points.at(-1);
  return `<div class="money-trend-chart"><div class="money-trend-heading"><span>期間末の財布残高</span><strong>${formatYen(last.balance)}</strong></div><svg viewBox="0 0 360 154" preserveAspectRatio="none" role="img" aria-label="${escape(description)}"><path class="money-trend-gridline" d="M10 14H350 M10 78H350 M10 142H350"/><path class="money-trend-line balance" d="${path}"/><circle class="money-trend-end" cx="${x(points.length - 1).toFixed(1)}" cy="${y(last.balance).toFixed(1)}" r="4"/></svg><div class="money-trend-axis"><span>${formatYen(smallest)}</span><span>${formatYen(largest)}</span></div><div class="money-trend-labels">${labels.map((point) => `<span>${escape(point.label)}</span>`).join("")}</div></div>`;
}

export function renderExpenseDonut(transactions, month, categories = []) {
  const items = expenseBreakdown(transactions, month, categories);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (!total) return `<p class="settings-copy">この月の支出を記録すると、カテゴリ別の割合が表示されます。</p>`;
  let start = 0;
  const slices = items.map((item) => {
    const end = start + item.amount / total * 100;
    const slice = `${item.color} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
    start = end;
    return slice;
  });
  const description = items.map((item) => `${item.label} ${formatYen(item.amount)}`).join("、");
  return `<div class="money-donut-layout"><div class="money-donut" role="img" aria-label="支出合計 ${formatYen(total)}。${escape(description)}" style="--donut-slices:${slices.join(",")}"><div><small>支出合計</small><strong>${formatYen(total)}</strong></div></div><div class="money-donut-legend">${items.map((item) => `<div><i style="background:${item.color}"></i><span>${escape(item.label)}</span><strong>${Math.round(item.amount / total * 100)}%</strong><small>${formatYen(item.amount)}</small></div>`).join("")}</div></div>`;
}
