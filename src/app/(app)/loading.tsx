import { Carregando } from "@/components/Carregando";

/** Aparece na hora ao trocar de página, enquanto o servidor monta a nova. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className="esqueleto h-8 w-56" />
        <div className="esqueleto h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="esqueleto h-24" />
        <div className="esqueleto h-24" />
        <div className="esqueleto h-24" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="esqueleto h-14" />
        ))}
      </div>
      <Carregando />
    </div>
  );
}
