// Leitura da planilha "esteira de produção" (vendas já realizadas).
import * as XLSX from "xlsx";

export type EsteiraLinha = {
  linha: number;
  status: string | null;
  data_venda: string;
  cpf: string;
  nome: string;
  banco: string | null;
  seguro: string | null;
  prazo: number | null;
  valor_bruto: number | null;
  producao: number | null;
  repasse: number | null;
  digitador: string | null;
  consultora: string | null;
  observacao: string | null;
  consultant_id: string | null;
  erros: string[];
};

const ALVOS: Record<string, string> = {
  status: "status",
  data: "data_venda",
  cpf: "cpf",
  nome: "nome",
  banco: "banco",
  "seguro?": "seguro",
  seguro: "seguro",
  prazo: "prazo",
  "valor bruto": "valor_bruto",
  producao: "producao",
  produção: "producao",
  repasse: "repasse",
  digitador: "digitador",
  consultora: "consultora",
  observacao: "observacao",
  observação: "observacao",
};

function texto(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function numero(v: unknown): number | null {
  const s = texto(v);
  if (!s) return null;
  if (typeof v === "number") return v;
  const limpo = s.replace(/[R$\s]/gi, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function data(v: unknown): string {
  if (v instanceof Date) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())).toISOString().slice(0, 10);
  const s = texto(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (br) {
    const ano = Number(br[3]!) < 100 ? 2000 + Number(br[3]!) : Number(br[3]!);
    return `${ano}-${String(br[2]).padStart(2, "0")}-${String(br[1]).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) as unknown as number);
    d.setUTCDate(d.getUTCDate() + v);
    return d.toISOString().slice(0, 10);
  }
  return "";
}

export function lerEsteira(buf: ArrayBuffer): EsteiraLinha[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const out: EsteiraLinha[] = [];
  for (const nomeAba of wb.SheetNames) {
    const sheet = wb.Sheets[nomeAba];
    if (!sheet) continue;
    const grade = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    // localiza a linha de cabeçalho (a que contém CPF e NOME)
    const idxHeader = grade.findIndex((r) => {
      const cels = (r ?? []).map((c) => texto(c).toLowerCase());
      return cels.includes("cpf") && cels.includes("nome");
    });
    if (idxHeader < 0) continue;
    const mapa = new Map<number, string>();
    (grade[idxHeader] ?? []).forEach((c, i) => {
      const chave = texto(c).toLowerCase().replace(/\s+/g, " ");
      const alvo = ALVOS[chave];
      if (alvo) mapa.set(i, alvo);
    });

    for (let i = idxHeader + 1; i < grade.length; i++) {
      const raw = grade[i] ?? [];
      const obj: Record<string, unknown> = {};
      mapa.forEach((campo, col) => (obj[campo] = raw[col]));
      const nome = texto(obj["nome"]);
      const cpf = texto(obj["cpf"]).replace(/\D/g, "");
      if (!nome && !cpf) continue;

      const dataVenda = data(obj["data_venda"]);
      const prazoTxt = texto(obj["prazo"]).replace(/\D/g, "");
      const erros: string[] = [];
      if (!nome) erros.push("Sem nome");
      if (cpf.length !== 11) erros.push("CPF inválido");
      if (!dataVenda) erros.push("Data inválida");

      out.push({
        linha: i + 1,
        status: texto(obj["status"]) || null,
        data_venda: dataVenda,
        cpf,
        nome,
        banco: texto(obj["banco"]) || null,
        seguro: texto(obj["seguro"]) || null,
        prazo: prazoTxt ? Number(prazoTxt) : null,
        valor_bruto: numero(obj["valor_bruto"]),
        producao: numero(obj["producao"]),
        repasse: numero(obj["repasse"]),
        digitador: texto(obj["digitador"]) || null,
        consultora: texto(obj["consultora"]) || null,
        observacao: texto(obj["observacao"]) || null,
        consultant_id: null,
        erros,
      });
    }
  }
  return out;
}

/** Casa o nome da planilha com uma conta do sistema (nome completo ou primeiro nome). */
export function casarConsultora(
  nome: string | null,
  contas: { user_id: string; nome: string }[],
): string | null {
  if (!nome) return null;
  const alvo = nome.trim().toLowerCase();
  if (!alvo) return null;
  const exato = contas.find((c) => c.nome.trim().toLowerCase() === alvo);
  if (exato) return exato.user_id;
  const porPrimeiro = contas.filter((c) => c.nome.trim().toLowerCase().split(/\s+/)[0] === alvo.split(/\s+/)[0]);
  if (porPrimeiro.length === 1) return porPrimeiro[0]!.user_id;
  const contem = contas.filter((c) => c.nome.trim().toLowerCase().includes(alvo));
  return contem.length === 1 ? contem[0]!.user_id : null;
}
