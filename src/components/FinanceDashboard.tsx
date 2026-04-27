import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  Home,
  LogOut,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat2,
  Trash2,
} from "lucide-react";
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

type CategoryForm = {
  name: string;
  color: string;
};

type DashboardTab = "resumo" | "lancamentos" | "recorrencias" | "categorias";

const today = new Date().toISOString().slice(0, 10);
const palette = ["#2f9e44", "#1971c2", "#f08c00", "#7048e8", "#d6336c", "#0ca678"];

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

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
  const [editingTransaction, setEditingTransaction] =
    useState<(TransactionForm & { id: string }) | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<(CategoryForm & { id: string; type: EntryType }) | null>(null);
  const [editingRecurring, setEditingRecurring] =
    useState<(RecurringForm & { id: string; is_active: boolean }) | null>(null);

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

    setMessage("Lancamento salvo.");
    setTransactionForm((current) => ({
      ...current,
      description: "",
      amount: "",
      notes: "",
    }));
    await loadData();
  }

  async function updateTransaction(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editingTransaction) return;

    const amount = toCents(editingTransaction.amount);
    if (!amount || !editingTransaction.description.trim() || !editingTransaction.entry_date) {
      setMessage("Preencha descricao, valor e data para salvar.");
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        type: editingTransaction.type,
        description: editingTransaction.description.trim(),
        amount_cents: amount,
        entry_date: editingTransaction.entry_date,
        category_id: editingTransaction.category_id || null,
        notes: editingTransaction.notes.trim() || null,
      })
      .eq("id", editingTransaction.id);

    if (error) {
      setMessage("Nao foi possivel atualizar o lancamento.");
      return;
    }

    setEditingTransaction(null);
    setMessage("Lancamento atualizado.");
    await loadData();
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user || !categoryName.trim()) return;

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

    setMessage("Categoria criada.");
    setCategoryName("");
    await loadData();
  }

  async function updateCategory(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editingCategory || !editingCategory.name.trim()) return;

    const { error } = await supabase
      .from("categories")
      .update({
        name: editingCategory.name.trim(),
        color: editingCategory.color,
      })
      .eq("id", editingCategory.id);

    if (error) {
      setMessage("Nao foi possivel atualizar a categoria.");
      return;
    }

    setEditingCategory(null);
    setMessage("Categoria atualizada.");
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

    setMessage("Recorrencia salva.");
    setRecurringForm((current) => ({ ...current, description: "", amount: "" }));
    await loadData();
  }

  async function updateRecurring(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editingRecurring) return;

    const amount = toCents(editingRecurring.amount);
    const day = Number(editingRecurring.day_of_month);
    if (!amount || !editingRecurring.description.trim() || day < 1 || day > 28) {
      setMessage("Preencha recorrencia com valor e dia entre 1 e 28.");
      return;
    }

    const { error } = await supabase
      .from("recurring_transactions")
      .update({
        type: editingRecurring.type,
        description: editingRecurring.description.trim(),
        amount_cents: amount,
        category_id: editingRecurring.category_id || null,
        day_of_month: day,
        is_active: editingRecurring.is_active,
      })
      .eq("id", editingRecurring.id);

    if (error) {
      setMessage("Nao foi possivel atualizar a recorrencia.");
      return;
    }

    setEditingRecurring(null);
    setMessage("Recorrencia atualizada.");
    await loadData();
  }

  async function deleteTransaction(id: string) {
    if (!supabase) return;
    if (!window.confirm("Apagar este lancamento?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    setMessage(error ? "Nao foi possivel apagar o lancamento." : "Lancamento apagado.");
    await loadData();
  }

  async function deleteCategory(id: string) {
    if (!supabase) return;
    if (!window.confirm("Apagar esta categoria? Lancamentos antigos ficam sem categoria.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    setMessage(error ? "Nao foi possivel apagar a categoria." : "Categoria apagada.");
    await loadData();
  }

  async function deleteRecurring(id: string) {
    if (!supabase) return;
    if (!window.confirm("Apagar esta recorrencia? Lancamentos ja gerados continuam salvos.")) return;
    const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
    setMessage(error ? "Nao foi possivel apagar a recorrencia." : "Recorrencia apagada.");
    await loadData();
  }

  async function toggleRecurring(item: RecurringTransaction) {
    if (!supabase) return;
    const { error } = await supabase
      .from("recurring_transactions")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    setMessage(error ? "Nao foi possivel alterar a recorrencia." : "Recorrencia atualizada.");
    await loadData();
  }

  function recurringAlreadyGenerated(item: RecurringTransaction) {
    return transactions.some((transaction) => {
      const hasNewMarker =
        transaction.source_recurring_id === item.id && transaction.source_month === selectedMonth;
      const hasLegacyMarker =
        transaction.notes?.includes(`recorrencia:${item.id}:${selectedMonth}`) ||
        (transaction.notes?.includes("Gerado de recorrencia") &&
          transaction.description === item.description &&
          transaction.type === item.type &&
          transaction.amount_cents === item.amount_cents &&
          transaction.category_id === item.category_id);

      return hasNewMarker || hasLegacyMarker;
    });
  }

  async function createFromRecurring(item: RecurringTransaction) {
    if (!supabase || !user) return;
    if (!item.is_active) {
      setMessage("Esta recorrencia esta pausada.");
      return;
    }
    if (recurringAlreadyGenerated(item)) {
      setMessage("Esta recorrencia ja foi gerada neste mes.");
      return;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, item.day_of_month).toISOString().slice(0, 10);
    const payload = {
      user_id: user.id,
      type: item.type,
      description: item.description,
      amount_cents: item.amount_cents,
      entry_date: date,
      category_id: item.category_id,
      notes: `Gerado de recorrencia:${item.id}:${selectedMonth}`,
      source_recurring_id: item.id,
      source_month: selectedMonth,
    };

    const { error } = await supabase.from("transactions").insert(payload);

    if (error) {
      const isMigrationMissing =
        error.message.includes("source_recurring_id") || error.message.includes("source_month");

      if (!isMigrationMissing) {
        setMessage("Nao foi possivel gerar o lancamento.");
        return;
      }

      const { error: fallbackError } = await supabase.from("transactions").insert({
        user_id: payload.user_id,
        type: payload.type,
        description: payload.description,
        amount_cents: payload.amount_cents,
        entry_date: payload.entry_date,
        category_id: payload.category_id,
        notes: payload.notes,
      });

      if (fallbackError) {
        setMessage("Nao foi possivel gerar o lancamento.");
        return;
      }

      setMessage("Lancamento gerado. Rode o SQL atualizado para ativar o bloqueio reforcado.");
      await loadData();
      return;
    }

    setMessage("Lancamento gerado.");
    await loadData();
  }

  function categoryNameFor(id: string | null) {
    return categories.find((item) => item.id === id)?.name ?? "Sem categoria";
  }

  function beginEditTransaction(item: Transaction) {
    setEditingTransaction({
      id: item.id,
      type: item.type,
      description: item.description,
      amount: centsToInput(item.amount_cents),
      entry_date: item.entry_date,
      category_id: item.category_id ?? "",
      notes: item.notes ?? "",
    });
  }

  function beginEditRecurring(item: RecurringTransaction) {
    setEditingRecurring({
      id: item.id,
      type: item.type,
      description: item.description,
      amount: centsToInput(item.amount_cents),
      category_id: item.category_id ?? "",
      day_of_month: String(item.day_of_month),
      is_active: item.is_active,
    });
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
              editTransaction={beginEditTransaction}
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
            editTransaction={beginEditTransaction}
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
              recurring.map((item) => {
                const generated = recurringAlreadyGenerated(item);
                return (
                  <article className={`data-card ${item.type}`} key={item.id}>
                    <div className="card-row">
                      <span className="type-pill">{item.type === "entrada" ? "Entrada" : "Saida"}</span>
                      <strong>{formatMoney(item.amount_cents)}</strong>
                    </div>
                    <h3>{item.description}</h3>
                    <p>
                      Dia {item.day_of_month} - {categoryNameFor(item.category_id)}
                    </p>
                    <span className={generated ? "status-pill success" : "status-pill"}>
                      {generated ? "Gerada neste mes" : item.is_active ? "Ativa" : "Pausada"}
                    </span>
                    <div className="card-actions">
                      <button className="ghost-button" onClick={() => createFromRecurring(item)} disabled={generated}>
                        <Plus size={16} />
                        Gerar
                      </button>
                      <button className="icon-button" onClick={() => beginEditRecurring(item)} title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => toggleRecurring(item)}
                        title={item.is_active ? "Pausar" : "Ativar"}
                      >
                        {item.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                      </button>
                      <button className="icon-button" onClick={() => deleteRecurring(item.id)} title="Apagar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })
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
                  <div className="card-actions">
                    <button
                      className="icon-button"
                      onClick={() =>
                        setEditingCategory({
                          id: item.id,
                          type: item.type,
                          name: item.name,
                          color: item.color,
                        })
                      }
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button className="icon-button" onClick={() => deleteCategory(item.id)} title="Apagar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {editingTransaction && (
        <Modal title="Editar lancamento" onClose={() => setEditingTransaction(null)}>
          <form className="modal-form" onSubmit={updateTransaction}>
            <select
              value={editingTransaction.type}
              onChange={(event) =>
                setEditingTransaction((current) =>
                  current
                    ? { ...current, type: event.target.value as EntryType, category_id: "" }
                    : current,
                )
              }
            >
              <option value="saida">Saida</option>
              <option value="entrada">Entrada</option>
            </select>
            <input
              value={editingTransaction.description}
              onChange={(event) =>
                setEditingTransaction((current) =>
                  current ? { ...current, description: event.target.value } : current,
                )
              }
            />
            <input
              value={editingTransaction.amount}
              inputMode="decimal"
              onChange={(event) =>
                setEditingTransaction((current) =>
                  current ? { ...current, amount: event.target.value } : current,
                )
              }
            />
            <input
              type="date"
              value={editingTransaction.entry_date}
              onChange={(event) =>
                setEditingTransaction((current) =>
                  current ? { ...current, entry_date: event.target.value } : current,
                )
              }
            />
            <select
              value={editingTransaction.category_id}
              onChange={(event) =>
                setEditingTransaction((current) =>
                  current ? { ...current, category_id: event.target.value } : current,
                )
              }
            >
              <option value="">Categoria</option>
              {categories
                .filter((item) => item.type === editingTransaction.type)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <input
              value={editingTransaction.notes}
              placeholder="Observacao"
              onChange={(event) =>
                setEditingTransaction((current) =>
                  current ? { ...current, notes: event.target.value } : current,
                )
              }
            />
            <button className="primary-button">Salvar alteracoes</button>
          </form>
        </Modal>
      )}

      {editingCategory && (
        <Modal title="Editar categoria" onClose={() => setEditingCategory(null)}>
          <form className="modal-form" onSubmit={updateCategory}>
            <input
              value={editingCategory.name}
              onChange={(event) =>
                setEditingCategory((current) => (current ? { ...current, name: event.target.value } : current))
              }
            />
            <input
              type="color"
              value={editingCategory.color}
              onChange={(event) =>
                setEditingCategory((current) => (current ? { ...current, color: event.target.value } : current))
              }
            />
            <button className="primary-button">Salvar categoria</button>
          </form>
        </Modal>
      )}

      {editingRecurring && (
        <Modal title="Editar recorrencia" onClose={() => setEditingRecurring(null)}>
          <form className="modal-form" onSubmit={updateRecurring}>
            <select
              value={editingRecurring.type}
              onChange={(event) =>
                setEditingRecurring((current) =>
                  current
                    ? { ...current, type: event.target.value as EntryType, category_id: "" }
                    : current,
                )
              }
            >
              <option value="saida">Saida</option>
              <option value="entrada">Entrada</option>
            </select>
            <input
              value={editingRecurring.description}
              onChange={(event) =>
                setEditingRecurring((current) =>
                  current ? { ...current, description: event.target.value } : current,
                )
              }
            />
            <input
              value={editingRecurring.amount}
              onChange={(event) =>
                setEditingRecurring((current) =>
                  current ? { ...current, amount: event.target.value } : current,
                )
              }
            />
            <input
              type="number"
              min="1"
              max="28"
              value={editingRecurring.day_of_month}
              onChange={(event) =>
                setEditingRecurring((current) =>
                  current ? { ...current, day_of_month: event.target.value } : current,
                )
              }
            />
            <select
              value={editingRecurring.category_id}
              onChange={(event) =>
                setEditingRecurring((current) =>
                  current ? { ...current, category_id: event.target.value } : current,
                )
              }
            >
              <option value="">Categoria</option>
              {categories
                .filter((item) => item.type === editingRecurring.type)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={editingRecurring.is_active}
                onChange={(event) =>
                  setEditingRecurring((current) =>
                    current ? { ...current, is_active: event.target.checked } : current,
                  )
                }
              />
              Recorrencia ativa
            </label>
            <button className="primary-button">Salvar recorrencia</button>
          </form>
        </Modal>
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
  editTransaction,
}: {
  transactions: Transaction[];
  loading: boolean;
  categoryNameFor: (id: string | null) => string;
  deleteTransaction: (id: string) => Promise<void>;
  editTransaction: (item: Transaction) => void;
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
            <div className="card-actions compact">
              <button className="icon-button" onClick={() => editTransaction(item)} title="Editar">
                <Pencil size={16} />
              </button>
              <button className="icon-button" onClick={() => deleteTransaction(item.id)} title="Apagar">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <section className="modal-card">
        <div className="panel-header">
          <h2>{title}</h2>
          <button className="ghost-button" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
