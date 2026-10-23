/**
 * Macro-setores para filtro, definidos por divisões da CNAE (os 2 primeiros dígitos do código da atividade).
 * É um agrupamento nosso, pensado para vendas B2B; não é uma classificação oficial.
 */
export interface Setor {
  id: string;
  nome: string;
  divisoes: number[];
}

export const SETORES: Setor[] = [
  { id: "agro", nome: "Agronegócio", divisoes: [1, 2, 3] },
  { id: "extrativa", nome: "Mineração e petróleo", divisoes: [5, 6, 7, 8, 9] },
  { id: "alimentos", nome: "Alimentos e bebidas (indústria)", divisoes: [10, 11] },
  { id: "industria", nome: "Indústria e manufatura", divisoes: [12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33] },
  { id: "farma", nome: "Farmacêutico", divisoes: [21] },
  { id: "energia", nome: "Energia, água e resíduos", divisoes: [35, 36, 37, 38, 39] },
  { id: "construcao", nome: "Construção", divisoes: [41, 42, 43] },
  { id: "automotivo", nome: "Automotivo", divisoes: [29, 30, 45] },
  { id: "atacado", nome: "Atacado e distribuição", divisoes: [46] },
  { id: "varejo", nome: "Varejo", divisoes: [47] },
  { id: "logistica", nome: "Logística e transporte", divisoes: [49, 50, 51, 52, 53] },
  { id: "turismo", nome: "Hotelaria, restaurantes e turismo", divisoes: [55, 56, 79] },
  { id: "midia", nome: "Mídia e comunicação", divisoes: [58, 59, 60] },
  { id: "ti", nome: "Tecnologia, software e telecom", divisoes: [61, 62, 63] },
  { id: "financeiro", nome: "Serviços financeiros e seguros", divisoes: [64, 65, 66] },
  { id: "imobiliario", nome: "Imobiliário", divisoes: [68] },
  { id: "profissionais", nome: "Serviços profissionais", divisoes: [69, 70, 71, 72, 74, 75] },
  { id: "marketing", nome: "Marketing e publicidade", divisoes: [73] },
  { id: "administrativos", nome: "Serviços administrativos e locação", divisoes: [77, 78, 80, 81, 82] },
  { id: "educacao", nome: "Educação", divisoes: [85] },
  { id: "saude", nome: "Saúde", divisoes: [86, 87, 88] },
  { id: "lazer", nome: "Cultura, esporte e lazer", divisoes: [90, 91, 92, 93] },
  { id: "associacoes", nome: "Associações, cooperativas e outros serviços", divisoes: [94, 95, 96] },
  { id: "publico", nome: "Administração pública", divisoes: [84] },
];

export const PORTES = ["Micro empresa", "Empresa de pequeno porte", "Demais"] as const;

export const ABERTURAS: { id: string; nome: string; deAnos: number; ateAnos: number }[] = [
  { id: "novas", nome: "Menos de 1 ano", deAnos: 0, ateAnos: 1 },
  { id: "1a3", nome: "1 a 3 anos", deAnos: 1, ateAnos: 3 },
  { id: "3a10", nome: "3 a 10 anos", deAnos: 3, ateAnos: 10 },
  { id: "10mais", nome: "Mais de 10 anos", deAnos: 10, ateAnos: 200 },
];

/** Faixas de código CNAE (7 dígitos) cobertas pelos setores escolhidos. */
export function faixasDeSetores(ids: string[]): [number, number][] {
  const divs = SETORES.filter((s) => ids.includes(s.id)).flatMap((s) => s.divisoes);
  return divs.map((d) => [d * 100000, d * 100000 + 99999]);
}
