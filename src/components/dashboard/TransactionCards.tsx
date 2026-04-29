import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { formatMoney, Transaction } from "../../lib/finance";
import { LoadingLogo } from "../LoadingLogo";

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
                  aria-label={item.is_paid ? "Desmarcar lançamento como pago" : "Marcar lançamento como pago"}
                  aria-pressed={item.is_paid}
                  disabled={isBusy}
                >
                  <CheckCircle2 size={16} />
                  {item.is_paid ? "Desmarcar" : "Marcar pago"}
                </button>
              )}
              <button
                className="icon-button"
                onClick={() => editTransaction(item)}
                title="Editar"
                aria-label="Editar lançamento"
                disabled={isBusy}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                onClick={() => deleteTransaction(item.id)}
                title="Apagar"
                aria-label="Apagar lançamento"
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
