import { ReactNode } from "react";

export function DashboardModal({
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
