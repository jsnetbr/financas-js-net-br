export type EntryType = "entrada" | "saida";

export type Category = {
  id: string;
  name: string;
  type: EntryType;
  color: string;
};

export type Transaction = {
  id: string;
  type: EntryType;
  description: string;
  amount_cents: number;
  entry_date: string;
  category_id: string | null;
  notes: string | null;
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

export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function getMonthRange(key: string) {
  const [year, month] = key.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
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

