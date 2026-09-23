// Integração server-only com o portal RockData (consultacadastral.rockdata.com.br).
// O portal não oferece API: reproduzimos, pelo servidor, os mesmos passos do site
// (login por formulário + endpoints internos do Localizador) e lemos o HTML.
const BASE = "https://consultacadastral.rockdata.com.br";

export type RockdataCampo = { label: string; valor: string };
export type RockdataTabela = { titulo: string; colunas: string[]; linhas: string[][] };

export type RockdataPessoa = {
  cpf: string | null;
  nome: string | null;
  nascimento: string | null;
  idade: string | null;
  sexo: string | null;
  mae: string | null;
  campos: RockdataCampo[];
};

export type RockdataFicha = {
  pessoa: RockdataPessoa;
  telefones: string[];
  emails: string[];
  enderecos: string[];
  tabelas: RockdataTabela[];
};

export type RockdataPessoaLista = {
  cpf: string;
  nome: string;
  idade: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

export class RockdataError extends Error {}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
}

function texto(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Faz login e devolve o cabeçalho Cookie da sessão autenticada. */
async function login(): Promise<string> {
  const usuario = process.env["ROCKDATA_USUARIO"];
  const senha = process.env["ROCKDATA_SENHA"];
  const cliente = process.env["ROCKDATA_CLIENTE"];
  if (!usuario || !senha || !cliente) {
    throw new RockdataError("Acesso à RockData não está configurado no sistema.");
  }

  const body = new URLSearchParams({ Usuario: usuario, Senha: senha, Cliente: cliente });
  const res = await fetch(`${BASE}/`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const cookies = res.headers.getSetCookie?.() ?? [];
  const raw = cookies.length ? cookies : [res.headers.get("set-cookie") ?? ""];
  const jar = raw
    .filter(Boolean)
    .map((c) => c.split(";")[0]!.trim())
    .filter((c) => c.includes("="));

  const temAuth = jar.some((c) => c.startsWith(".ASPXAUTH="));
  if (!temAuth) {
    throw new RockdataError("Não foi possível entrar na RockData com o acesso cadastrado.");
  }
  return jar.join("; ");
}

async function postLocalizador(cookie: string, acao: string, dados: Record<string, string>) {
  const res = await fetch(`${BASE}/Localizador/Consulta/${acao}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams(dados).toString(),
  });
  const html = await res.text();
  if (res.status >= 300 && res.status < 400) {
    throw new RockdataError("A RockData não retornou dados para esta consulta.");
  }
  if (!res.ok) throw new RockdataError("A RockData está indisponível neste momento.");
  return html;
}

/** Lê os pares rótulo/valor dos campos readonly da ficha. */
function lerCampos(html: string): RockdataCampo[] {
  const vistos = new Set<string>();
  const out: RockdataCampo[] = [];
  const re = /<label[^>]*>\s*([^<]{1,60}?)\s*<\/label>[\s\S]{0,400}?value="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const label = decodeEntities(m[1]!).trim();
    const valor = decodeEntities(m[2]!).trim();
    if (!label || !valor) continue;
    const chave = `${label}|${valor}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ label, valor });
  }
  return out;
}

function lerTabelas(html: string): RockdataTabela[] {
  const out: RockdataTabela[] = [];
  const tabelas = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  for (const t of tabelas) {
    const colunas = (t.match(/<th[\s\S]*?<\/th>/g) ?? [])
      .map((th) => texto(th))
      .filter((c) => c && c.toLowerCase() !== "ações");
    const linhas: string[][] = [];
    for (const tr of t.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const tds = (tr.match(/<td[\s\S]*?<\/td>/g) ?? []).map((td) => texto(td));
      if (!tds.length) continue;
      const limpo = tds.filter((_, i) => !(i === 0 && tds[0] === ""));
      if (limpo.some((c) => c)) linhas.push(limpo);
    }
    if (linhas.length) out.push({ titulo: colunas[0] ?? "Dados", colunas, linhas });
  }
  return out;
}

function valorCampo(campos: RockdataCampo[], ...labels: string[]): string | null {
  for (const l of labels) {
    const achado = campos.find((c) => c.label.toLowerCase() === l.toLowerCase());
    if (achado) return achado.valor;
  }
  return null;
}

function coletar(tabelas: RockdataTabela[], padrao: RegExp): string[] {
  const set = new Set<string>();
  for (const t of tabelas) {
    const temColuna = t.colunas.some((c) => padrao.test(c.toLowerCase()));
    if (!temColuna) continue;
    for (const linha of t.linhas) {
      for (const celula of linha) {
        if (!celula) continue;
        if (/^(buscando|válido|inválido|qualifica)/i.test(celula)) continue;
        if (padrao.source.includes("telefone") && !/\d{4}/.test(celula)) continue;
        if (padrao.source.includes("email") && !celula.includes("@")) continue;
        if (padrao.source.includes("endere") && celula.length < 8) continue;
        set.add(celula);
      }
    }
  }
  return [...set];
}

export function parseFicha(html: string): RockdataFicha {
  const campos = lerCampos(html);
  const tabelas = lerTabelas(html);
  return {
    pessoa: {
      cpf: valorCampo(campos, "CPF"),
      nome: valorCampo(campos, "Nome"),
      nascimento: valorCampo(campos, "Nascimento"),
      idade: valorCampo(campos, "Idade"),
      sexo: valorCampo(campos, "Sexo"),
      mae: valorCampo(campos, "Nome da mãe", "Nome da mae"),
      campos,
    },
    telefones: coletar(tabelas, /telefone/),
    emails: coletar(tabelas, /email/),
    enderecos: coletar(tabelas, /endere/),
    tabelas,
  };
}

/** Consulta a ficha completa por CPF (11 dígitos). */
export async function consultarPorCpf(cpf: string): Promise<RockdataFicha> {
  const cookie = await login();
  const html = await postLocalizador(cookie, "LocalizadorPf_View", { cpf });
  const ficha = parseFicha(html);
  if (!ficha.pessoa.nome && !ficha.telefones.length) {
    throw new RockdataError("A RockData não encontrou dados para este CPF.");
  }
  return ficha;
}

/** Normaliza telefone: só dígitos, sem código do país (55). */
export function normalizeTelefone(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

/** Telefones da ficha normalizados (para gravar na coluna telefones). */
export function telefonesDaFicha(ficha: RockdataFicha): string[] {
  const set = new Set<string>();
  for (const t of ficha.telefones) {
    const d = normalizeTelefone(t);
    if (d.length >= 8 && d.length <= 11) set.add(d);
  }
  return [...set];
}

/** Busca pessoas por nome ou telefone; devolve a lista para escolher o CPF. */
async function consultarLista(campo: "nome" | "telefone", valor: string): Promise<RockdataPessoaLista[]> {
  const cookie = await login();
  const html = await postLocalizador(cookie, "ConsultaMaisOpcoes_View", {
    nome: campo === "nome" ? valor : "",
    telefone: campo === "telefone" ? valor : "",
    cidade: "",
    uf: "",
    cep: "",
    numeroCep: "",
    email: "",
    dtNascimentoAbertura: "",
    tipoPessoa: "pf",
  });

  const out: RockdataPessoaLista[] = [];
  for (const t of lerTabelas(html)) {
    const cols = t.colunas.map((c) => c.toLowerCase());
    if (!cols.includes("cpf") || !cols.includes("nome")) continue;
    for (const linha of t.linhas) {
      const idx = (nomeCol: string) => cols.indexOf(nomeCol);
      const cpf = (linha[idx("cpf")] ?? "").replace(/\D/g, "");
      const nomeEncontrado = linha[idx("nome")] ?? "";
      if (cpf.length !== 11 || !nomeEncontrado) continue;
      out.push({
        cpf,
        nome: nomeEncontrado,
        idade: linha[idx("idade")] ?? null,
        bairro: cols.includes("bairro") ? linha[idx("bairro")] ?? null : null,
        cidade: cols.includes("cidade") ? linha[idx("cidade")] ?? null : null,
        uf: cols.includes("uf") ? linha[idx("uf")] ?? null : null,
      });
    }
  }
  return out.slice(0, 50);
}

/** Busca pessoas por nome; devolve a lista para escolher o CPF. */
export function consultarPorNome(nome: string): Promise<RockdataPessoaLista[]> {
  return consultarLista("nome", nome);
}

/** Busca pessoas por telefone (com DDD, só dígitos); devolve a lista para escolher o CPF. */
export function consultarPorTelefone(telefone: string): Promise<RockdataPessoaLista[]> {
  return consultarLista("telefone", telefone);
}
