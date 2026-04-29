import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSummary,
  getMonthRange,
  hasDuplicateCategoryName,
  monthKey,
  todayKey,
  toCents,
  type Category,
  type RecurringTransaction,
  type Transaction,
} from "../src/lib/finance.js";

test("todayKey and monthKey use local date parts", () => {
  const date = new Date(2026, 3, 27, 23, 59, 0);

  assert.equal(todayKey(date), "2026-04-27");
  assert.equal(monthKey(date), "2026-04");
});

test("getMonthRange returns the safe local month boundaries", () => {
  assert.deepEqual(getMonthRange("2026-04"), {
    start: "2026-04-01",
    end: "2026-05-01",
  });

  assert.deepEqual(getMonthRange("2026-12"), {
    start: "2026-12-01",
    end: "2027-01-01",
  });
});

test("toCents converts Brazilian currency input safely", () => {
  assert.equal(toCents("2.700,45"), 270045);
  assert.equal(toCents("39,10"), 3910);
  assert.equal(toCents("0"), null);
  assert.equal(toCents(""), null);
});

test("hasDuplicateCategoryName ignores case and surrounding spaces", () => {
  const categories: Category[] = [
    { id: "1", name: "Mercado", type: "saida", color: "#f08c00" },
    { id: "2", name: "Salario", type: "entrada", color: "#2f9e44" },
  ];

  assert.equal(hasDuplicateCategoryName(categories, " mercado ", "saida"), true);
  assert.equal(hasDuplicateCategoryName(categories, "mercado", "entrada"), false);
  assert.equal(hasDuplicateCategoryName(categories, "Mercado", "saida", "1"), false);
});

test("calculateSummary keeps current totals and expected balance intact", () => {
  const transactions: Transaction[] = [
    {
      id: "t1",
      type: "entrada",
      description: "Salario",
      amount_cents: 270000,
      entry_date: "2026-04-05",
      category_id: "c1",
      notes: null,
      is_paid: false,
    },
    {
      id: "t2",
      type: "saida",
      description: "Mercado",
      amount_cents: 15251,
      entry_date: "2026-04-10",
      category_id: "c2",
      notes: null,
      is_paid: true,
    },
  ];

  const recurring: RecurringTransaction[] = [
    {
      id: "r1",
      type: "saida",
      description: "Internet",
      amount_cents: 10000,
      category_id: "c3",
      day_of_month: 15,
      is_active: true,
    },
    {
      id: "r2",
      type: "entrada",
      description: "Extra",
      amount_cents: 5000,
      category_id: "c4",
      day_of_month: 20,
      is_active: true,
    },
  ];

  assert.deepEqual(calculateSummary(transactions, recurring), {
    income: 270000,
    expense: 15251,
    balance: 254749,
    expectedBalance: 249749,
  });
});
