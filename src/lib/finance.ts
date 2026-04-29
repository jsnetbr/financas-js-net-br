export type EntryType = "entrada" | "saida";

export type Category = {
  id: string;
  name: string;
  type: EntryType;
  color: string;
};

export type CategoryLimit = {
  id: string;
  category_id: string;
  amount_cents: number;
};

export type Transaction = {
  id: string;
  type: EntryType;
  description: string;
  amount_cents: number;
  entry_date: string;
  category_id: string | null;
  notes: string | null;
  is_paid: boolean;
  source_recurring_id?: string | null;
  source_month?: string | null;
};

export type RecurringTransaction = {
  id: string;
  type: EntryType;
  description: string;
  amount_cents: number;
  category_id: string | null;
  day_of_month: number;
  is_active: boolean;
};

export const defaultCategories: Array<Omit<Category, "id">> = [
  { name: "Salario", type: "entrada", color: "#2f9e44" },
  { name: "Extra", type: "entrada", color: "#1971c2" },
  { name: "Mercado", type: "saida", color: "#f08c00" },
  { name: "Casa", type: "saida", color: "#7048e8" },
  { name: "Transporte", type: "saida", color: "#d6336c" },
  { name: "Lazer", type: "saida", color: "#0ca678" },
];

export function toCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 100);
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayKey(date = new Date()) {
  return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeCategoryName(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function hasDuplicateCategoryName(
  categories: Category[],
  name: string,
  type: EntryType,
  ignoreId?: string,
) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return false;

  return categories.some((item) => {
    if (item.type !== type) return false;
    if (ignoreId && item.id === ignoreId) return false;
    return normalizeCategoryName(item.name) === normalized;
  });
}

export function getMonthRange(key: string) {
  const [year, month] = key.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return {
    start: dateKeyFromParts(year, month, 1),
    end: dateKeyFromParts(nextYear, nextMonth, 1),
  };
}

export function calculateSummary(transactions: Transaction[], recurring: RecurringTransaction[]) {
  const income = transactions
    .filter((item) => item.type === "entrada")
    .reduce((total, item) => total + item.amount_cents, 0);
  const expense = transactions
    .filter((item) => item.type === "saida")
    .reduce((total, item) => total + item.amount_cents, 0);
  const expectedIncome = recurring
    .filter((item) => item.is_active && item.type === "entrada")
    .reduce((total, item) => total + item.amount_cents, 0);
  const expectedExpense = recurring
    .filter((item) => item.is_active && item.type === "saida")
    .reduce((total, item) => total + item.amount_cents, 0);

  return {
    income,
    expense,
    balance: income - expense,
    expectedBalance: income + expectedIncome - expense - expectedExpense,
  };
}
