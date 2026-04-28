type LoadingLogoProps = {
  label?: string;
  compact?: boolean;
};

export function LoadingLogo({ label = "Carregando...", compact = false }: LoadingLogoProps) {
  return (
    <div className={compact ? "logo-loader compact" : "logo-loader"} role="status" aria-live="polite">
      <span className="logo-loader-mark" aria-hidden="true">
        <img src="/icon-v2.svg" alt="" />
      </span>
      <span>{label}</span>
    </div>
  );
}
