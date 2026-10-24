import type { ReactNode, SVGProps } from "react";

/** Ícones de traço (24×24), sem dependência externa. Herdam a cor do texto. */
const base = (filhos: ReactNode) =>
  function Icone(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        {filhos}
      </svg>
    );
  };

export const Busca = base(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const Descobrir = base(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>);
export const Base = base(<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>);
export const Listas = base(<><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="3" /></>);
export const Importar = base(<><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></>);
export const Creditos = base(<><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1 1.7 2.8 2 2.8.8 2.8 2-1.1 2-2.8 2c-1.3 0-2.3-.4-2.8-1.2M12 6.5V8m0 8v1.5" /></>);
export const Equipe = base(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.8c2.1.6 3.5 2.3 3.5 5.2" /></>);
export const Config = base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const Plataforma = base(<><path d="M12 3 4 6v5c0 4.5 3.2 8.3 8 10 4.8-1.7 8-5.5 8-10V6z" /><path d="m9 12 2 2 4-4" /></>);
export const Menu = base(<><path d="M4 6h16M4 12h16M4 18h16" /></>);
export const Fechar = base(<><path d="M6 6l12 12M18 6 6 18" /></>);
export const Filtro = base(<><path d="M3 5h18l-7 8v6l-4-2v-4z" /></>);
export const Seta = base(<><path d="m9 6 6 6-6 6" /></>);
export const Mapa = base(<><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>);
export const Externo = base(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>);
export const Estrela = base(<><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>);
export const Predio = base(<><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 10h5a1 1 0 0 1 1 1v10M2 21h20M8 8h2M8 12h2M8 16h2" /></>);
export const Pessoa = base(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></>);
export const Jornal = base(<><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>);
export const Sparkles = base(<><path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>);
export const Salvar = base(<><path d="M6 3h12v18l-6-4-6 4z" /></>);
export const Telefone = base(<><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>);
export const Email = base(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>);
export const Relogio = base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const Check = base(<><path d="m5 12.5 4.5 4.5L19 7.5" /></>);
export const Alerta = base(<><path d="M12 4 2.5 20h19z" /><path d="M12 10v5M12 18h.01" /></>);

export const ICONES = { Busca, Descobrir, Base, Listas, Importar, Creditos, Equipe, Config, Plataforma } as const;
export type NomeIcone = keyof typeof ICONES;
