export function LogoIcone({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#0c6a6e" />
      <path d="M44 21.5A15 15 0 1 0 44 42.5" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="46" cy="32" r="5" fill="#f5a524" />
      <path d="M33 32h8" stroke="#f5a524" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoIcone />
      <span className={`text-lg font-bold tracking-tight ${claro ? "text-white" : "text-tinta"}`}>
        Conecta<span className={claro ? "text-marca-200" : "text-marca-700"}>-B2B</span>
      </span>
    </span>
  );
}
