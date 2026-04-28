import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Home,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat2,
  CheckCircle2,
  Gauge,
  Settings,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LoadingLogo } from "./LoadingLogo";
import {
  calculateSummary,
  Category,
  CategoryLimit,
  dateKeyFromParts,
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

type DashboardTab =
  | "resumo"
  | "lancamentos"
  | "recorrencias"
  | "categorias"
  | "limites"
  | "relatorios"
  | "configuracoes";

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
};

type NoticeTone = "info" | "success" | "error";

type PendingAction =
  | "refresh"
  | "transaction"
  | "category"
  | "limit"
  | "recurring"
  | "paid"
  | "profile"
  | "email"
  | "password"
  | "confirm"
  | null;

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

type MaybeDisplayNameError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const today = new Date().toISOString().slice(0, 10);
const palette = ["#2f9e44", "#1971c2", "#f08c00", "#7048e8", "#d6336c", "#0ca678"];

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function shiftMonthKey(value: string, delta: number) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return monthKey();

  const totalMonths = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = String((totalMonths % 12) + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

function daysInMonthKey(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function inferNoticeTone(text: string): NoticeTone {
  const normalized = text.toLowerCase();
  if (
    normalized.includes("nao foi possivel") ||
    normalized.includes("preencha") ||
    normalized.includes("informe") ||
    normalized.includes("precisa") ||
    normalized.includes("nao confere") ||
    normalized.includes("ja foi") ||
    normalized.includes("pausada") ||
    normalized.includes("ainda nao")
  ) {
    return "error";
  }

  return "success";
}

function isMissingDisplayNameColumn(error: MaybeDisplayNameError | null) {
  if (!error) return false;
  const details = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return details.includes("display_name") || error.code === "PGRST204" || error.code === "42703";
}

export function FinanceDashboard() {
  const { user, signOut } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("resumo");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeCategoryType, setActiveCategoryType] = useState<EntryType>("saida");
  const [loading, setLoading] = useState(true);
  const [message, setRawMessage] = useState("");
  const [messageTone, setMessageTone] = useState<NoticeTone>("info");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [supportsDisplayName, setSupportsDisplayName] = useState(true);
  const [transactionForm, setTransactionForm] = useState<TransactionForm>({
    type: "saida",
    description: "",
    amount: "",
    entry_date: today,
    category_id: "",
    notes: "",
  });
  const [categoryName, setCategoryName] = useState("");
  const [limitForm, setLimitForm] = useState({ category_id: "", amount: "" });
  const [displayName, setDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
  const expenseCategories = categories.filter((item) => item.type === "saida");
  const monthExpenses = transactions.filter((item) => item.type === "saida");
  const limitRows = expenseCategories.map((category) => {
    const limit = categoryLimits.find((item) => item.category_id === category.id);
    const spent = monthExpenses
      .filter((item) => item.category_id === category.id)
      .reduce((total, item) => total + item.amount_cents, 0);
    return {
      category,
      limit,
      spent,
      percent: limit ? Math.min(100, Math.round((spent / limit.amount_cents) * 100)) : 0,
    };
  });
  const reportExpenseRows = expenseCategories
    .map((category) => {
      const spent = monthExpenses
        .filter((item) => item.category_id === category.id)
        .reduce((total, item) => total + item.amount_cents, 0);
      const limit = categoryLimits.find((item) => item.category_id === category.id);
      const limitPercent = limit ? Math.round((spent / limit.amount_cents) * 100) : 0;
      return { category, spent, limit, limitPercent };
    })
    .filter((item) => item.spent > 0 || item.limit)
    .sort((a, b) => b.spent - a.spent);
  const topExpenseCategory = reportExpenseRows.find((item) => item.spent > 0);
  const maxExpenseByCategory = Math.max(1, ...reportExpenseRows.map((item) => item.spent));
  const biggestExpenses = [...monthExpenses].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, 5);
  const dailyExpenseRows = Array.from({ length: daysInMonthKey(selectedMonth) }, (_, index) => {
    const day = index + 1;
    const dayKey = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    const spent = monthExpenses
      .filter((item) => item.entry_date === dayKey)
      .reduce((total, item) => total + item.amount_cents, 0);
    return { day, spent };
  }).filter((item) => item.spent > 0);
  const maxDailyExpense = Math.max(1, ...dailyExpenseRows.map((item) => item.spent));
  const isBusy = pendingAction !== null;

  function setMessage(text: string, tone?: NoticeTone) {
    setRawMessage(text);
    setMessageTone(text ? tone ?? inferNoticeTone(text) : "info");
  }

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [selectedMonth, user]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setRawMessage(""), 6500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function loadData(showRefreshMessage = false) {
    if (!supabase || !user) return;
    setLoading(true);
    if (showRefreshMessage) setPendingAction("refresh");

    try {
      await ensureBaseData();
      const { start, end } = getMonthRange(selectedMonth);

      const [categoryResult, limitResult, transactionResult, recurringResult] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("category_limits").select("id,category_id,amount_cents"),
        supabase
          .from("transactions")
          .select("*")
          .gte("entry_date", start)
          .lt("entry_date", end)
          .order("entry_date", { ascending: false }),
        supabase.from("recurring_transactions").select("*").order("day_of_month"),
      ]);

      let profileResult;
      if (supportsDisplayName) {
        profileResult = await supabase.from("profiles").select("id,email,display_name").eq("id", user.id).maybeSingle();

        if (isMissingDisplayNameColumn(profileResult.error as MaybeDisplayNameError | null)) {
          setSupportsDisplayName(false);
          profileResult = await supabase.from("profiles").select("id,email").eq("id", user.id).maybeSingle();
        }
      } else {
        profileResult = await supabase.from("profiles").select("id,email").eq("id", user.id).maybeSingle();
      }

      if (profileResult.error || categoryResult.error || limitResult.error || transactionResult.error || recurringResult.error) {
        setMessage("Nao foi possivel carregar os dados agora.", "error");
      } else {
        const profileRow = profileResult.data as { id: string; email: string; display_name?: string | null } | null;
        const nextProfile = profileRow
          ? { id: profileRow.id, email: profileRow.email, display_name: profileRow.display_name ?? null }
          : null;
        setProfile(nextProfile);
        setDisplayName(nextProfile?.display_name ?? "");
        setNewEmail(user.email ?? "");
        setCategories(categoryResult.data ?? []);
        setCategoryLimits(limitResult.data ?? []);
        setTransactions(transactionResult.data ?? []);
        setRecurring(recurringResult.data ?? []);
        if (showRefreshMessage) setMessage("Dados atualizados.");
      }
    } catch {
      setMessage("Nao foi possivel carregar os dados agora.", "error");
    } finally {
      setLoading(false);
      if (showRefreshMessage) setPendingAction(null);
    }
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
    if (!supabase || !user || isBusy) return;

    const amount = toCents(transactionForm.amount);
    if (!amount || !transactionForm.description.trim() || !transactionForm.entry_date) {
      setMessage("Preencha descricao, valor e data para salvar.");
      return;
    }

    setPendingAction("transaction");
    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: transactionForm.type,
        description: transactionForm.description.trim(),
        amount_cents: amount,
        entry_date: transactionForm.entry_date,
        category_id: transactionForm.category_id || null,
        notes: transactionForm.notes.trim() || null,
        is_paid: false,
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
    } catch {
      setMessage("Nao foi possivel salvar o lancamento.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateTransaction(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editingTransaction || isBusy) return;

    const amount = toCents(editingTransaction.amount);
    if (!amount || !editingTransaction.description.trim() || !editingTransaction.entry_date) {
      setMessage("Preencha descricao, valor e data para salvar.");
      return;
    }

    setPendingAction("transaction");
    try {
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
    } catch {
      setMessage("Nao foi possivel atualizar o lancamento.");
    } finally {
      setPendingAction(null);
    }
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user || isBusy) return;
    if (!categoryName.trim()) {
      setMessage("Informe o nome da categoria.");
      return;
    }

    setPendingAction("category");
    try {
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
    } catch {
      setMessage("Nao foi possivel criar a categoria.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateCategory(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editingCategory || isBusy) return;
    if (!editingCategory.name.trim()) {
      setMessage("Informe o nome da categoria.");
      return;
    }

    setPendingAction("category");
    try {
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
    } catch {
      setMessage("Nao foi possivel atualizar a categoria.");
    } finally {
      setPendingAction(null);
    }
  }

  async function saveCategoryLimit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user || isBusy) return;

    const amount = toCents(limitForm.amount);
    if (!limitForm.category_id || !amount) {
      setMessage("Escolha uma categoria e informe o limite.");
      return;
    }

    setPendingAction("limit");
    try {
      const { error } = await supabase.from("category_limits").upsert(
        {
          user_id: user.id,
          category_id: limitForm.category_id,
          amount_cents: amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,category_id" },
      );

      if (error) {
        setMessage("Nao foi possivel salvar o limite.");
        return;
      }

      setMessage("Limite salvo.");
      setLimitForm({ category_id: "", amount: "" });
      await loadData();
    } catch {
      setMessage("Nao foi possivel salvar o limite.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteCategoryLimit(id: string) {
    if (!supabase) return;
    const client = supabase;
    setConfirmDialog({
      title: "Remover limite?",
      message: "A categoria continua existindo, apenas o limite mensal sera removido.",
      confirmLabel: "Remover",
      onConfirm: async () => {
        const { error } = await client.from("category_limits").delete().eq("id", id);
        setMessage(error ? "Nao foi possivel remover o limite." : "Limite removido.");
        await loadData();
      },
    });
  }

  async function addRecurring(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user || isBusy) return;

    const amount = toCents(recurringForm.amount);
    const day = Number(recurringForm.day_of_month);
    if (!amount || !recurringForm.description.trim() || day < 1 || day > 28) {
      setMessage("Preencha recorrencia com valor e dia entre 1 e 28.");
      return;
    }

    setPendingAction("recurring");
    try {
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
    } catch {
      setMessage("Nao foi possivel salvar a recorrencia.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateRecurring(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !editingRecurring || isBusy) return;

    const amount = toCents(editingRecurring.amount);
    const day = Number(editingRecurring.day_of_month);
    if (!amount || !editingRecurring.description.trim() || day < 1 || day > 28) {
      setMessage("Preencha recorrencia com valor e dia entre 1 e 28.");
      return;
    }

    setPendingAction("recurring");
    try {
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
    } catch {
      setMessage("Nao foi possivel atualizar a recorrencia.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteTransaction(id: string) {
    if (!supabase) return;
    const client = supabase;
    setConfirmDialog({
      title: "Apagar lancamento?",
      message: "Esta acao remove o lancamento deste mes.",
      confirmLabel: "Apagar",
      onConfirm: async () => {
        const { error } = await client.from("transactions").delete().eq("id", id);
        setMessage(error ? "Nao foi possivel apagar o lancamento." : "Lancamento apagado.");
        await loadData();
      },
    });
  }

  async function deleteCategory(id: string) {
    if (!supabase) return;
    const client = supabase;
    setConfirmDialog({
      title: "Apagar categoria?",
      message: "Lancamentos antigos continuam salvos e ficam sem categoria.",
      confirmLabel: "Apagar",
      onConfirm: async () => {
        const { error } = await client.from("categories").delete().eq("id", id);
        setMessage(error ? "Nao foi possivel apagar a categoria." : "Categoria apagada.");
        await loadData();
      },
    });
  }

  async function deleteRecurring(id: string) {
    if (!supabase) return;
    const client = supabase;
    setConfirmDialog({
      title: "Apagar recorrencia?",
      message: "Lancamentos ja gerados continuam salvos.",
      confirmLabel: "Apagar",
      onConfirm: async () => {
        const { error } = await client.from("recurring_transactions").delete().eq("id", id);
        setMessage(error ? "Nao foi possivel apagar a recorrencia." : "Recorrencia apagada.");
        await loadData();
      },
    });
  }

  async function confirmCurrentAction() {
    if (!confirmDialog || isBusy) return;
    setPendingAction("confirm");
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch {
      setMessage("Nao foi possivel concluir a acao.", "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleRecurring(item: RecurringTransaction) {
    if (!supabase || isBusy) return;
    setPendingAction("recurring");
    try {
      const { error } = await supabase
        .from("recurring_transactions")
        .update({ is_active: !item.is_active })
        .eq("id", item.id);

      setMessage(error ? "Nao foi possivel alterar a recorrencia." : "Recorrencia atualizada.");
      await loadData();
    } catch {
      setMessage("Nao foi possivel alterar a recorrencia.");
    } finally {
      setPendingAction(null);
    }
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
    const date = dateKeyFromParts(year, month, item.day_of_month);
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
      is_paid: false,
    };

    setPendingAction("recurring");
    try {
      const { error } = await supabase.from("transactions").insert(payload);

      if (error) {
        setMessage(error.code === "23505" ? "Esta recorrencia ja foi gerada neste mes." : "Nao foi possivel gerar o lancamento.");
        return;
      }

      setMessage("Lancamento gerado.");
      await loadData();
    } catch {
      setMessage("Nao foi possivel gerar o lancamento.");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleTransactionPaid(item: Transaction) {
    if (!supabase || item.type !== "saida" || isBusy) return;
    setPendingAction("paid");
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ is_paid: !item.is_paid })
        .eq("id", item.id);

      setMessage(error ? "Nao foi possivel alterar o status de pagamento." : "Status atualizado.");
      await loadData();
    } catch {
      setMessage("Nao foi possivel alterar o status de pagamento.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateDisplayName(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user || isBusy) return;
    if (!supportsDisplayName) {
      setMessage("Nome exibido indisponivel no momento. Atualize a pagina e tente de novo.");
      return;
    }

    const nextName = displayName.trim();
    setPendingAction("profile");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: nextName || null, email: user.email ?? "" })
        .eq("id", user.id);

      if (error) {
        setMessage("Nao foi possivel salvar o nome exibido.");
        return;
      }

      setProfile((current) =>
        current
          ? { ...current, display_name: nextName || null, email: user.email ?? current.email }
          : { id: user.id, email: user.email ?? "", display_name: nextName || null },
      );
      setDisplayName(nextName);
      setMessage("Nome exibido salvo.");
    } catch {
      setMessage("Nao foi possivel salvar o nome exibido.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updateEmail(event: FormEvent) {
    event.preventDefault();
    if (!supabase || isBusy) return;

    const email = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Informe um email valido.");
      return;
    }

    setPendingAction("email");
    try {
      const { error } = await supabase.auth.updateUser({ email });
      setMessage(
        error
          ? "Nao foi possivel atualizar o email."
          : "Pedido de troca enviado. Confira seu email para confirmar.",
      );
    } catch {
      setMessage("Nao foi possivel atualizar o email.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (!supabase || isBusy) return;

    if (newPassword.length < 6) {
      setMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("A confirmacao da senha nao confere.");
      return;
    }

    setPendingAction("password");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setMessage("Nao foi possivel atualizar a senha.");
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setMessage("Senha atualizada.");
    } catch {
      setMessage("Nao foi possivel atualizar a senha.");
    } finally {
      setPendingAction(null);
    }
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

  function goToPreviousMonth() {
    setSelectedMonth((current) => shiftMonthKey(current, -1));
  }

  function goToNextMonth() {
    setSelectedMonth((current) => shiftMonthKey(current, 1));
  }

  const tabs: Array<{ id: DashboardTab; label: string; icon: typeof Home }> = [
    { id: "resumo", label: "Resumo", icon: Home },
    { id: "lancamentos", label: "Lancamentos", icon: ReceiptText },
    { id: "recorrencias", label: "Recorrencias", icon: Repeat2 },
    { id: "categorias", label: "Categorias", icon: FolderOpen },
    { id: "limites", label: "Limites", icon: Gauge },
    { id: "relatorios", label: "Relatorios", icon: BarChart3 },
    { id: "configuracoes", label: "Configuracoes", icon: Settings },
  ];

  const profileLabel = profile?.display_name?.trim() || user?.email || "Controle pessoal";

  const navigation = tabs.map((tab) => {
    const Icon = tab.icon;
    return (
      <button
        key={tab.id}
        className={activeTab === tab.id ? "active" : ""}
        onClick={() => setActiveTab(tab.id)}
        title={tab.label}
        aria-label={tab.label}
      >
        <Icon size={18} />
        <span>{tab.label}</span>
      </button>
    );
  });

  return (
    <main className={sidebarCollapsed ? "app-layout sidebar-collapsed" : "app-layout"}>
      <aside className="sidebar" aria-label="Navegacao principal">
        <div className="sidebar-brand">
          <div className="sidebar-mark">
            <img src="/icon-v2.svg" alt="" aria-hidden="true" />
          </div>
          <div className="sidebar-copy">
            <strong>Financas</strong>
            <span>{profileLabel}</span>
          </div>
        </div>

        <nav className="sidebar-nav">{navigation}</nav>

        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          aria-pressed={sidebarCollapsed}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span>{sidebarCollapsed ? "Expandir" : "Recolher"}</span>
        </button>
      </aside>

      <section className="app-shell">
      <header className="topbar">
        <div>
          <h1>Financas</h1>
          <p>{profileLabel}</p>
        </div>
        <div className="topbar-actions">
          <div className="month-nav" role="group" aria-label="Navegacao de mes">
            <button className="icon-button" onClick={goToPreviousMonth} title="Mes anterior" aria-label="Mes anterior">
              <ChevronLeft size={18} />
            </button>
            <input
              aria-label="Mes"
              className="month-picker"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
            <button className="icon-button" onClick={goToNextMonth} title="Mes seguinte" aria-label="Mes seguinte">
              <ChevronRight size={18} />
            </button>
          </div>
          <button className="icon-button" onClick={signOut} title="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {message && <div className={`notice ${messageTone}`}>{message}</div>}

      <nav className="mobile-tabbar" aria-label="Areas do app">
        {navigation}
      </nav>

      {activeTab === "resumo" && (
        <section className="tab-panel">
          <section className="summary-grid">
            <SummaryCard title="Entradas" value={formatMoney(summary.income)} tone="income" />
            <SummaryCard title="Saidas" value={formatMoney(summary.expense)} tone="expense" />
            <SummaryCard title="Saldo" value={formatMoney(summary.balance)} tone="balance" />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Mes filtrado</p>
                <h2>Saidas do mes</h2>
              </div>
              <button className="ghost-button" onClick={() => loadData(true)} disabled={isBusy}>
                <RefreshCw size={16} />
                {pendingAction === "refresh" ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
            <TransactionCards
              transactions={monthExpenses}
              loading={loading}
              categoryNameFor={categoryNameFor}
              deleteTransaction={deleteTransaction}
              editTransaction={beginEditTransaction}
              togglePaid={toggleTransactionPaid}
              emptyMessage="Nenhuma saida neste mes."
              isBusy={isBusy}
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
            <button className="ghost-button" onClick={() => loadData(true)} disabled={isBusy}>
              <RefreshCw size={16} />
              {pendingAction === "refresh" ? "Atualizando..." : "Atualizar"}
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
            <button className="primary-button" disabled={isBusy}>
              <Plus size={16} />
              {pendingAction === "transaction" ? "Salvando..." : "Salvar"}
            </button>
          </form>

          <TransactionCards
            transactions={transactions}
            loading={loading}
            categoryNameFor={categoryNameFor}
            deleteTransaction={deleteTransaction}
            editTransaction={beginEditTransaction}
            togglePaid={toggleTransactionPaid}
            isBusy={isBusy}
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
            <button className="primary-button" disabled={isBusy}>
              <Plus size={16} />
              {pendingAction === "recurring" ? "Salvando..." : "Salvar recorrencia"}
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
                      <button
                        className="ghost-button"
                        onClick={() => createFromRecurring(item)}
                        disabled={generated || isBusy}
                      >
                        <Plus size={16} />
                        Gerar
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => beginEditRecurring(item)}
                        title="Editar"
                        disabled={isBusy}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => toggleRecurring(item)}
                        title={item.is_active ? "Pausar" : "Ativar"}
                        disabled={isBusy}
                      >
                        {item.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => deleteRecurring(item.id)}
                        title="Apagar"
                        disabled={isBusy}
                      >
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
            <button className="primary-button" disabled={isBusy}>
              <Plus size={16} />
              {pendingAction === "category" ? "Adicionando..." : "Adicionar"}
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
                      disabled={isBusy}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => deleteCategory(item.id)}
                      title="Apagar"
                      disabled={isBusy}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === "limites" && (
        <section className="tab-panel panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Controle mensal</p>
              <h2>Limites por categoria</h2>
            </div>
          </div>

          <form className="limit-form card-form" onSubmit={saveCategoryLimit}>
            <select
              value={limitForm.category_id}
              onChange={(event) => {
                const categoryId = event.target.value;
                const currentLimit = categoryLimits.find((item) => item.category_id === categoryId);
                setLimitForm({
                  category_id: categoryId,
                  amount: currentLimit ? centsToInput(currentLimit.amount_cents) : "",
                });
              }}
            >
              <option value="">Categoria de saida</option>
              {expenseCategories.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Limite mensal"
              inputMode="decimal"
              value={limitForm.amount}
              onChange={(event) => setLimitForm((current) => ({ ...current, amount: event.target.value }))}
            />
            <button className="primary-button" disabled={isBusy}>
              {pendingAction === "limit" ? "Salvando..." : "Salvar limite"}
            </button>
          </form>

          <div className="limit-grid">
            {limitRows.length === 0 ? (
              <p className="empty-state">Crie categorias de saida para definir limites.</p>
            ) : (
              limitRows.map(({ category, limit, spent, percent }) => {
                const exceeded = Boolean(limit && spent > limit.amount_cents);
                return (
                  <article className="limit-card" key={category.id}>
                    <div className="card-row">
                      <div>
                        <span className="type-pill">Saida</span>
                        <h3>{category.name}</h3>
                      </div>
                      {limit && (
                        <button
                          className="icon-button"
                          onClick={() => deleteCategoryLimit(limit.id)}
                          title="Remover limite"
                          disabled={isBusy}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="limit-values">
                      <span>Gasto: {formatMoney(spent)}</span>
                      <strong>{limit ? `Limite: ${formatMoney(limit.amount_cents)}` : "Sem limite"}</strong>
                    </div>
                    <div className="limit-meter" aria-label={`Uso do limite de ${category.name}`}>
                      <span
                        className={exceeded ? "exceeded" : ""}
                        style={{ width: limit ? `${percent}%` : "0%" }}
                      />
                    </div>
                    <p className={exceeded ? "limit-alert danger" : "limit-alert"}>
                      {limit
                        ? exceeded
                          ? `Passou ${formatMoney(spent - limit.amount_cents)} do limite.`
                          : `Ainda resta ${formatMoney(limit.amount_cents - spent)}.`
                        : "Defina um valor para acompanhar essa categoria."}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {activeTab === "relatorios" && (
        <section className="tab-panel">
          <section className="report-hero panel">
            <div>
              <p className="eyebrow">Analise mensal</p>
              <h2>Relatorios</h2>
              <p>
                Veja onde o dinheiro saiu no mes filtrado e quais categorias precisam de mais atencao.
              </p>
            </div>
            <div className="report-highlight">
              <span>Maior categoria</span>
              <strong>{topExpenseCategory ? topExpenseCategory.category.name : "Sem gastos"}</strong>
              <small>{topExpenseCategory ? formatMoney(topExpenseCategory.spent) : "Nenhuma saida neste mes"}</small>
            </div>
          </section>

          <section className="summary-grid report-summary">
            <SummaryCard title="Entradas" value={formatMoney(summary.income)} tone="income" />
            <SummaryCard title="Saidas" value={formatMoney(summary.expense)} tone="expense" />
            <SummaryCard title="Saldo" value={formatMoney(summary.balance)} tone="balance" />
          </section>

          <section className="report-grid">
            <article className="panel report-panel wide">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Categorias</p>
                  <h2>Gastos por categoria</h2>
                </div>
              </div>
              {reportExpenseRows.length === 0 ? (
                <p className="empty-state">Nenhuma saida para analisar neste mes.</p>
              ) : (
                <div className="report-bars">
                  {reportExpenseRows.map(({ category, spent }) => (
                    <div className="report-bar-row" key={category.id}>
                      <div className="report-bar-label">
                        <span>{category.name}</span>
                        <strong>{formatMoney(spent)}</strong>
                      </div>
                      <div className="report-track" aria-label={`Gasto em ${category.name}`}>
                        <span
                          style={{
                            width: `${Math.max(6, Math.round((spent / maxExpenseByCategory) * 100))}%`,
                            background: category.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel report-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Ranking</p>
                  <h2>Maiores gastos</h2>
                </div>
              </div>
              {biggestExpenses.length === 0 ? (
                <p className="empty-state">Nenhum gasto neste mes.</p>
              ) : (
                <div className="expense-ranking">
                  {biggestExpenses.map((item, index) => (
                    <div className="ranking-row" key={item.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{item.description}</strong>
                        <small>{categoryNameFor(item.category_id)}</small>
                      </div>
                      <b>{formatMoney(item.amount_cents)}</b>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel report-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Limites</p>
                  <h2>Status dos limites</h2>
                </div>
              </div>
              {reportExpenseRows.filter((item) => item.limit).length === 0 ? (
                <p className="empty-state">Cadastre limites para acompanhar alertas.</p>
              ) : (
                <div className="limit-status-list">
                  {reportExpenseRows
                    .filter((item) => item.limit)
                    .map(({ category, spent, limit, limitPercent }) => {
                      const exceeded = Boolean(limit && spent > limit.amount_cents);
                      const closeToLimit = Boolean(limit && limitPercent >= 80);
                      return (
                        <div className="limit-status-row" key={category.id}>
                          <div>
                            <strong>{category.name}</strong>
                            <small>
                              {formatMoney(spent)} de {limit ? formatMoney(limit.amount_cents) : "R$ 0,00"}
                            </small>
                          </div>
                          <span className={exceeded ? "danger" : closeToLimit ? "warning" : "success"}>
                            {exceeded ? "Acima" : closeToLimit ? "Atencao" : "Ok"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </article>

            <article className="panel report-panel wide">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Calendario</p>
                  <h2>Evolucao diaria das saidas</h2>
                </div>
              </div>
              {dailyExpenseRows.length === 0 ? (
                <p className="empty-state">Nenhuma saida diaria para exibir.</p>
              ) : (
                <div className="daily-chart" aria-label="Gastos diarios do mes">
                  {dailyExpenseRows.map((item) => (
                    <div className="daily-column" key={item.day}>
                      <span style={{ height: `${Math.max(10, Math.round((item.spent / maxDailyExpense) * 100))}%` }} />
                      <small>{item.day}</small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </section>
      )}

      {activeTab === "configuracoes" && (
        <section className="tab-panel panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Conta</p>
              <h2>Configuracoes</h2>
            </div>
          </div>

          <div className="settings-grid">
            <form className="settings-card" onSubmit={updateDisplayName}>
              <div>
                <p className="eyebrow">Perfil</p>
                <h3>Nome exibido</h3>
                <p>Esse nome aparece no topo do app e no menu lateral.</p>
              </div>
              <label>
                Nome
                <input
                  value={displayName}
                  placeholder="Seu nome"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <button className="primary-button" disabled={isBusy}>
                {pendingAction === "profile" ? "Salvando..." : "Salvar nome"}
              </button>
            </form>

            <form className="settings-card" onSubmit={updateEmail}>
              <div>
                <p className="eyebrow">Acesso</p>
                <h3>Email</h3>
                <p>Pode ser preciso confirmar a troca no email atual e no novo email.</p>
              </div>
              <label>
                Novo email
                <input
                  type="email"
                  value={newEmail}
                  placeholder="email@exemplo.com"
                  onChange={(event) => setNewEmail(event.target.value)}
                />
              </label>
              <button className="primary-button" disabled={isBusy}>
                {pendingAction === "email" ? "Enviando..." : "Atualizar email"}
              </button>
            </form>

            <form className="settings-card" onSubmit={updatePassword}>
              <div>
                <p className="eyebrow">Seguranca</p>
                <h3>Senha</h3>
                <p>Use pelo menos 6 caracteres e confirme a nova senha.</p>
              </div>
              <label>
                Nova senha
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                Confirmar senha
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button className="primary-button" disabled={isBusy}>
                {pendingAction === "password" ? "Atualizando..." : "Atualizar senha"}
              </button>
            </form>
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
            <button className="primary-button" disabled={isBusy}>
              {pendingAction === "transaction" ? "Salvando..." : "Salvar alteracoes"}
            </button>
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
            <button className="primary-button" disabled={isBusy}>
              {pendingAction === "category" ? "Salvando..." : "Salvar categoria"}
            </button>
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
            <button className="primary-button" disabled={isBusy}>
              {pendingAction === "recurring" ? "Salvando..." : "Salvar recorrencia"}
            </button>
          </form>
        </Modal>
      )}
      {confirmDialog && (
        <Modal title={confirmDialog.title} onClose={() => setConfirmDialog(null)}>
          <p className="confirm-message">{confirmDialog.message}</p>
          <div className="modal-actions">
            <button className="ghost-button" onClick={() => setConfirmDialog(null)} disabled={isBusy}>
              Cancelar
            </button>
            <button className="danger-button" onClick={confirmCurrentAction} disabled={isBusy}>
              {pendingAction === "confirm" ? "Aguarde..." : confirmDialog.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
      </section>
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
  togglePaid,
  emptyMessage = "Nenhum lancamento neste mes.",
  isBusy,
}: {
  transactions: Transaction[];
  loading: boolean;
  categoryNameFor: (id: string | null) => string;
  deleteTransaction: (id: string) => Promise<void>;
  editTransaction: (item: Transaction) => void;
  togglePaid: (item: Transaction) => Promise<void>;
  emptyMessage?: string;
  isBusy: boolean;
}) {
  if (loading) {
    return <LoadingLogo compact label="Carregando dados..." />;
  }

  if (transactions.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
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
          {item.type === "saida" && (
            <span className={item.is_paid ? "status-pill success" : "status-pill pending"}>
              {item.is_paid ? "Pago" : "Pendente"}
            </span>
          )}
          <div className="card-row footer">
            <span>{new Date(`${item.entry_date}T00:00:00`).toLocaleDateString("pt-BR")}</span>
            <div className="card-actions compact">
              {item.type === "saida" && (
                <button
                  className={item.is_paid ? "ghost-button paid-action" : "ghost-button"}
                  onClick={() => togglePaid(item)}
                  title={item.is_paid ? "Desmarcar pagamento" : "Marcar como pago"}
                  disabled={isBusy}
                >
                  <CheckCircle2 size={16} />
                  {item.is_paid ? "Desmarcar" : "Marcar pago"}
                </button>
              )}
              <button className="icon-button" onClick={() => editTransaction(item)} title="Editar" disabled={isBusy}>
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                onClick={() => deleteTransaction(item.id)}
                title="Apagar"
                disabled={isBusy}
              >
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
