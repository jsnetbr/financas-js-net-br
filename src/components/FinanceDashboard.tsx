import { FormEvent, useEffect, useMemo, useState } from "react";
import { FolderOpen, Home, LogOut, Plus, ReceiptText, RefreshCw, Repeat2, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  calculateSummary,
  Category,
  defaultCategories,
  EntryType,
  formatMoney,
  getMonthRange,
  monthKey,
  RecurringTransaction,
  toCents,
  Transaction,
} from "../lib/finance";
import { supabase } from "../lib/supabase";

type TransactionForm = {
  type: EntryType;
  description: string;
  amount: string;
  entry_date: string;
  category_id: string;
  notes: string;
};

type RecurringForm = {
  type: EntryType;
  description: string;
  amount: string;
  category_id: string;
  day_of_month: string;
};

type DashboardTab = "resumo" | "lancamentos" | "recorrencias" | "categorias";

const today = new Date().toISOString().slice(0, 10);

export function FinanceDashboard() {
  const { user, signOut } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>("resumo");
  const [activeCategoryType, setActiveCategoryType] = useState<EntryType>("saida");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [transactionForm, setTransactionForm] = useState<TransactionForm>({
    type: "saida",
    description: "",
    amount: "",
    entry_date: today,
    category_id: "",
    notes: "",
  });
  const [categoryName, setCategoryName] = useState("");
  const [recurringForm, setRecurringForm] = useState<RecurringForm>({
    type: "saida",
    description: "",
    amount: "",
    category_id: "",
    day_of_month: "5",
  });

  const summary = useMemo(() => calculateSummary(transactions, recurring), [transactions, recurring]);
  const categoriesByType = categories.filter((item) => item.type === transactionForm.type);
  const recurringCategoriesByType = categories.filter((item) => item.type === recurringForm.type);
  const visibleCategories = categories.filter((item) => item.type === activeCategoryType);
  const latestTransactions = transactions.slice(0, 4);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [selectedMonth, user]);

  async function loadData() {
    if (!supabase || !user) return;
    setLoading(true);
    setMessage("");
    await ensureBaseData();
    const { start, end } = getMonthRange(selectedMonth);

    const [categoryResult, transactionResult, recurringResult] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("transactions")
        .select("*")
        .gte("entry_date", start)
        .lt("entry_date", end)
        .order("entry_date", { ascending: false }),
      supabase.from("recurring_transactions").select("*").order("day_of_month"),
    ]);

    if (categoryResult.error || transactionResult.error || recurringResult.error) {
      setMessage("Nao foi possivel carregar os dados. Confira se o SQL do Supabase foi aplicado.");
    } else {
      setCategories(categoryResult.data ?? []);
      setTransactions(transactionResult.data ?? []);
      setRecurring(recurringResult.data ?? []);
    }
    setLoading(false);
  }

  async function ensureBaseData() {
    if (!supabase || !user) return;
    await supabase.from("profiles").upsert({ id: user.id, email: user.email ?? "" });

    const { count } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true });

    if (count === 0) {
      await supabase.from("categories").insert(
        defaultCategories.map((item) => ({
          ...item,
          user_id: user.id,
        })),
      );
    }
  }

  async function addTransaction(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;

    const amount = toCents(transactionForm.amount);
    if (!amount || !transactionForm.description.trim() || !transactionForm.entry_date) {
      setMessage("Preencha descricao, valor e data para salvar.");
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: transactionForm.type,
      description: transactionForm.description.trim(),
      amount_cents: amount,
      entry_date: transactionForm.entry_date,
      category_id: transactionForm.category_id || null,
      notes: transactionForm.notes.trim() || null,
    });

    if (error) {
      setMessage("Nao foi possivel salvar o lancamento.");
      return;
    }

    setTransactionForm((current) => ({
      ...current,
      description: "",
      amount: "",
      notes: "",
    }));
    await loadData();
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user || !categoryName.trim()) return;

    const palette = ["#2f9e44", "#1971c2", "#f08c00", "#7048e8", "#d6336c", "#0ca678"];
    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: categoryName.trim(),
      type: activeCategoryType,
      color: palette[categories.length % palette.length],
    });

    if (error) {
      setMessage("Nao foi possivel criar a categoria.");
      return;
    }

    setCategoryName("");
    await loadData();
  }

  async function addRecurring(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;

    const amount = toCents(recurringForm.amount);
    const day = Number(recurringForm.day_of_month);
    if (!amount || !recurringForm.description.trim() || day < 1 || day > 28) {
      setMessage("Preencha recorrencia com valor e dia entre 1 e 28.");
      return;
    }

    const { error } = await supabase.from("recurring_transactions").insert({
      user_id: user.id,
      type: recurringForm.type,
      description: recurringForm.description.trim(),
      amount_cents: amount,
      category_id: recurringForm.category_id || null,
      day_of_month: day,
      is_active: true,
    });

    if (error) {
      setMessage("Nao foi possivel salvar a recorrencia.");
      return;
    }

    setRecurringForm((current) => ({ ...current, description: "", amount: "" }));
    await loadData();
  }

  async function deleteTransaction(id: string) {
    if (!supabase) return;
    await supabase.from("transactions").delete().eq("id", id);
    await loadData();
  }

  async function createFromRecurring(item: RecurringTransaction) {
    if (!supabase || !user) return;
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, item.day_of_month).toISOString().slice(0, 10);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: item.type,
      description: item.description,
      amount_cents: item.amount_cents,
      entry_date: date,
      category_id: item.category_id,
      notes: "Gerado de recorrencia",
    });

    if (error) {
      setMessage("Nao foi possivel gerar o lancamento.");
      return;
    }
    await loadData();
  }

  function categoryNameFor(id: string | null) {
    return categories.find((item) => item.id === id)?.name ?? "Sem categoria";
  }

  const tabs: Array<{ id: DashboardTab; label: string; icon: typeof Home }> = [
    { id: "resumo", label: "Resumo", icon: Home },
    { id: "lancamentos", label: "Lancamentos", icon: ReceiptText },
    { id: "recorrencias", label: "Recorrencias", icon: Repeat2 },
    { id: "categorias", label: "Categorias", icon: FolderOpen },
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p>Controle pessoal</p>
          <h1>Financas</h1>
        </div>
        <div className="topbar-actions">
          <input
            aria-label="Mes"
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          />
          <button className="icon-button" onClick={signOut} title="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      <nav className="tabbar" aria-label="Areas do app">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "resumo" && (
        <section className="tab-panel">
          <section className="summary-grid">
            <SummaryCard title="Entradas" value={formatMoney(summary.income)} tone="income" />
            <SummaryCard title="Saidas" value={formatMoney(summary.expense)} tone="expense" />
            <SummaryCard title="Saldo" value={formatMoney(summary.balance)} tone="balance" />
            <SummaryCard title="Previsto" value={formatMoney(summary.expectedBalance)} tone="expected" />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Mes selecionado</p>
                <h2>Ultimos lancamentos</h2>
              </div>
              <button className="ghost-button" onClick={loadData}>
                <RefreshCw size={16} />
                Atualizar
              </button>
            </div>
            <TransactionCards
              transactions={latestTransactions}
              loading={loading}
              categoryNameFor={categoryNameFor}
              deleteTransaction={deleteTransaction}
            />
          </section>
        </section>
      )}

      {activeTab === "lancamentos" && (
        <section className="tab-panel panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Entradas e saidas</p>
              <h2>Lancamentos do mes</h2>
            </div>
            <button className="ghost-button" onClick={loadData}>
              <RefreshCw size={16} />
              Atualizar
            </button>
          </div>

          <form className="entry-form card-form" onSubmit={addTransaction}>
            <select
              value={transactionForm.type}
              onChange={(event) =>
                setTransactionForm((current) => ({
                  ...current,
                  type: event.target.value as EntryType,
                  category_id: "",
                }))
              }
            >
              <option value="saida">Saida</option>
              <option value="entrada">Entrada</option>
            </select>
            <input
              placeholder="Descricao"
              value={transactionForm.description}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, description: event.target.value }))
              }
            />
            <input
              placeholder="Valor"
              inputMode="decimal"
              value={transactionForm.amount}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
            <input
              type="date"
              value={transactionForm.entry_date}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, entry_date: event.target.value }))
              }
            />
            <select
              value={transactionForm.category_id}
              onChange={(event) =>
                setTransactionForm((current) => ({ ...current, category_id: event.target.value }))
              }
            >
              <option value="">Categoria</option>
              {categoriesByType.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button className="primary-button">
              <Plus size={16} />
              Salvar
            </button>
          </form>

          <TransactionCards
            transactions={transactions}
            loading={loading}
            categoryNameFor={categoryNameFor}
            deleteTransaction={deleteTransaction}
          />
        </section>
      )}

      {activeTab === "recorrencias" && (
        <section className="tab-panel panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Contas fixas</p>
              <h2>Recorrencias</h2>
            </div>
          </div>

          <form className="recurring-form card-form" onSubmit={addRecurring}>
            <select
              value={recurringForm.type}
              onChange={(event) =>
                setRecurringForm((current) => ({
                  ...current,
                  type: event.target.value as EntryType,
                  category_id: "",
                }))
              }
            >
              <option value="saida">Saida</option>
              <option value="entrada">Entrada</option>
            </select>
            <input
              placeholder="Descricao"
              value={recurringForm.description}
              onChange={(event) =>
                setRecurringForm((current) => ({ ...current, description: event.target.value }))
              }
            />
            <input
              placeholder="Valor"
              value={recurringForm.amount}
              onChange={(event) =>
                setRecurringForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
            <input
              type="number"
              min="1"
              max="28"
              value={recurringForm.day_of_month}
              onChange={(event) =>
                setRecurringForm((current) => ({ ...current, day_of_month: event.target.value }))
              }
            />
            <select
              value={recurringForm.category_id}
              onChange={(event) =>
                setRecurringForm((current) => ({ ...current, category_id: event.target.value }))
              }
            >
              <option value="">Categoria</option>
              {recurringCategoriesByType.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button className="primary-button">
              <Plus size={16} />
              Salvar recorrencia
            </button>
          </form>

          <div className="card-grid">
            {recurring.length === 0 ? (
              <p className="empty-state">Nenhuma recorrencia cadastrada.</p>
            ) : (
              recurring.map((item) => (
                <article className={`data-card ${item.type}`} key={item.id}>
                  <div className="card-row">
                    <span className="type-pill">{item.type === "entrada" ? "Entrada" : "Saida"}</span>
                    <strong>{formatMoney(item.amount_cents)}</strong>
                  </div>
                  <h3>{item.description}</h3>
                  <p>
                    Dia {item.day_of_month} - {categoryNameFor(item.category_id)}
                  </p>
                  <button className="ghost-button" onClick={() => createFromRecurring(item)}>
                    <Plus size={16} />
                    Gerar no mes
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === "categorias" && (
        <section className="tab-panel panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Organizacao</p>
              <h2>Categorias</h2>
            </div>
          </div>

          <div className="subtabbar" aria-label="Tipo de categoria">
            <button
              className={activeCategoryType === "saida" ? "active" : ""}
              onClick={() => setActiveCategoryType("saida")}
            >
              Saidas
            </button>
            <button
              className={activeCategoryType === "entrada" ? "active" : ""}
              onClick={() => setActiveCategoryType("entrada")}
            >
              Entradas
            </button>
          </div>

          <form className="category-form card-form" onSubmit={addCategory}>
            <input
              placeholder={`Nova categoria de ${activeCategoryType === "entrada" ? "entrada" : "saida"}`}
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
            />
            <button className="primary-button">
              <Plus size={16} />
              Adicionar
            </button>
          </form>

          <div className="category-grid">
            {visibleCategories.length === 0 ? (
              <p className="empty-state">Nenhuma categoria neste grupo.</p>
            ) : (
              visibleCategories.map((item) => (
                <article className="category-card" key={item.id} style={{ borderTopColor: item.color }}>
                  <span>{item.type === "entrada" ? "Entrada" : "Saida"}</span>
                  <strong>{item.name}</strong>
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone: string }) {
  return (
    <article className={`summary-card ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function TransactionCards({
  transactions,
  loading,
  categoryNameFor,
  deleteTransaction,
}: {
  transactions: Transaction[];
  loading: boolean;
  categoryNameFor: (id: string | null) => string;
  deleteTransaction: (id: string) => Promise<void>;
}) {
  if (loading) {
    return <p className="empty-state">Carregando...</p>;
  }

  if (transactions.length === 0) {
    return <p className="empty-state">Nenhum lancamento neste mes.</p>;
  }

  return (
    <div className="card-grid">
      {transactions.map((item) => (
        <article className={`data-card ${item.type}`} key={item.id}>
          <div className="card-row">
            <span className="type-pill">{item.type === "entrada" ? "Entrada" : "Saida"}</span>
            <strong className={item.type === "entrada" ? "money-income" : "money-expense"}>
              {formatMoney(item.amount_cents)}
            </strong>
          </div>
          <h3>{item.description}</h3>
          <p>{categoryNameFor(item.category_id)}</p>
          <div className="card-row footer">
            <span>{new Date(`${item.entry_date}T00:00:00`).toLocaleDateString("pt-BR")}</span>
            <button className="icon-button" onClick={() => deleteTransaction(item.id)} title="Apagar">
              <Trash2 size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
