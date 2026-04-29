import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { formatMoney, Transaction } from "../../lib/finance";
import { LoadingLogo } from "../LoadingLogo";

type SortKey = "date" | "type" | "description" | "category" | "amount" | "status";
type SortDirection = "asc" | "desc";

export function TransactionCards({
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
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const sortedTransactions = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...transactions].sort((a, b) => {
      const compareText = (left: string, right: string) => left.localeCompare(right, "pt-BR");
      let result = 0;

      if (sortKey === "date") {
        result = a.entry_date.localeCompare(b.entry_date);
      }
      if (sortKey === "type") {
        result = compareText(a.type, b.type);
      }
      if (sortKey === "description") {
        result = compareText(a.description, b.description);
      }
      if (sortKey === "category") {
        result = compareText(categoryNameFor(a.category_id), categoryNameFor(b.category_id));
      }
      if (sortKey === "amount") {
        result = a.amount_cents - b.amount_cents;
      }
      if (sortKey === "status") {
        const statusFor = (item: Transaction) =>
          item.type === "entrada" ? "recebido" : item.is_paid ? "pago" : "pendente";
        result = compareText(statusFor(a), statusFor(b));
      }

      return result * direction;
    });
  }, [categoryNameFor, sortDirection, sortKey, transactions]);

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "date" ? "desc" : "asc");
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button className="table-sort-button" onClick={() => changeSort(key)} type="button">
        {label}
        <span>{sortKey === key ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    );
  }

  if (loading) {
    return <LoadingLogo compact label="Carregando dados..." />;
  }

  if (transactions.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="excel-table-wrap">
      <table className="excel-table">
        <thead>
          <tr>
            <th aria-sort={sortKey === "date" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
              {headerButton("date", "Data")}
            </th>
            <th aria-sort={sortKey === "type" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
              {headerButton("type", "Tipo")}
            </th>
            <th
              aria-sort={
                sortKey === "description" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
              }
            >
              {headerButton("description", "Descricao")}
            </th>
            <th
              aria-sort={sortKey === "category" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
            >
              {headerButton("category", "Categoria")}
            </th>
            <th aria-sort={sortKey === "amount" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
              {headerButton("amount", "Valor")}
            </th>
            <th aria-sort={sortKey === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
              {headerButton("status", "Status")}
            </th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {sortedTransactions.map((item) => (
            <tr key={item.id}>
              <td>{new Date(`${item.entry_date}T00:00:00`).toLocaleDateString("pt-BR")}</td>
              <td>
                <span className="type-pill">{item.type === "entrada" ? "Entrada" : "Saida"}</span>
              </td>
              <td className="excel-table__description">{item.description}</td>
              <td>{categoryNameFor(item.category_id)}</td>
              <td className={item.type === "entrada" ? "money-income" : "money-expense"}>
                {formatMoney(item.amount_cents)}
              </td>
              <td>
                {item.type === "saida" ? (
                  <span className={item.is_paid ? "status-pill success" : "status-pill pending"}>
                    {item.is_paid ? "Pago" : "Pendente"}
                  </span>
                ) : (
                  <span className="status-pill success">Recebido</span>
                )}
              </td>
              <td>
                <div className="table-actions">
                  {item.type === "saida" && (
                    <button
                      className={item.is_paid ? "icon-button paid-action" : "icon-button"}
                      onClick={() => togglePaid(item)}
                      title={item.is_paid ? "Desmarcar pagamento" : "Marcar como pago"}
                      aria-label={item.is_paid ? "Desmarcar lancamento como pago" : "Marcar lancamento como pago"}
                      aria-pressed={item.is_paid}
                      disabled={isBusy}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    onClick={() => editTransaction(item)}
                    title="Editar"
                    aria-label="Editar lancamento"
                    disabled={isBusy}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => deleteTransaction(item.id)}
                    title="Apagar"
                    aria-label="Apagar lancamento"
                    disabled={isBusy}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
