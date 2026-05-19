
# Diagnóstico — Verificar SafeConsig falha com "fetch failed (causa: redirect count exceeded)"

## 1) Onde está implementada a chamada

Não é Supabase Edge Function. É um **TanStack server function** (roda no Worker do Cloudflare via TanStack Start), arquivo:

- `src/lib/safeconsig.functions.ts` → `consultarSafeConsig = createServerFn({ method: "POST" })`

Chamada do client em `src/routes/safe-consig.tsx` via `useServerFn(consultarSafeConsig)` → POST para `/_serverFn/...consultarSafeConsig...`.

URL alvo / fluxo: portal JSF/PrimeFaces da SafeConsig Alagoas, simulando o "Esqueci Minha Senha":

```
const BASE = "https://alagoas.safeconsig.com.br";
const LOGIN_URL = `${BASE}/safe/login`;
```

## 2) Como o fetch está configurado

Três `fetch()` em sequência, todos para `LOGIN_URL`:

- **Etapa 1 (GET):** `redirect: "follow"` explícito. Sem cookies enviados.
- **Etapa 2 (POST AJAX):** sem `redirect` definido → **default `"follow"`**. Envia `Cookie: cookies1` capturados da etapa 1.
- **Etapa 3 (POST com CPF):** idem, default `"follow"`, envia cookies concatenados das etapas 1 + 2.

Captura de cookies via `parseSetCookie(headers)` usando `getSetCookie()` quando disponível — ok em Workers. Mas:

- Só guarda `name=value` (`c.split(";")[0]`), **descarta `Path`, `Domain`, `Expires`** — aceitável.
- **Concatena cookies sem deduplicar**: `cookies2Joined = [cookies1, parseSetCookie(r2.headers)].join("; ")`. Se a etapa 2 reemitir `JSESSIONID` (rotação de sessão típica no JSF após mudança de view), o header vai com **dois `JSESSIONID`**, e o servidor pode usar o errado.
- ViewState (CSRF do JSF) é extraído por regex de CDATA / hidden input — funciona quando a resposta é a esperada, mas não há fallback se a resposta for um redirect 302 puro (sem corpo HTML/XML).

Logs prévios confirmaram que `/safe/login` responde **302 → `/safe/selecaoOrgaoGestor`** e seta `JSESSIONID; path=/safe`. Ou seja, a página de login **já redireciona** antes mesmo de poder extrair o ViewState.

## 3) Por que cai em loop de redirect

Cadeia provável no Worker do Cloudflare (`fetch` segue redirect com limite ~20):

1. GET `/safe/login` → 302 `Location: /safe/selecaoOrgaoGestor`, `Set-Cookie: JSESSIONID=A; path=/safe`.
2. O `fetch` do Worker segue para `/safe/selecaoOrgaoGestor`, **mas não reenvia o cookie `JSESSIONID=A` recebido no hop anterior** (o `fetch` do workerd, diferente de browsers, não mantém jar de cookies entre hops de redirect).
3. `/safe/selecaoOrgaoGestor` exige sessão → responde 302 de volta para `/safe/login` (e seta novo `JSESSIONID=B`).
4. `/safe/login` → 302 `/safe/selecaoOrgaoGestor` de novo… e assim por diante.
5. Estoura o limite de redirects → `TypeError: fetch failed` com `cause: "redirect count exceeded"`.

O loop, portanto, acontece **já na Etapa 1 (GET inicial)** — antes mesmo de chegar nas Etapas 2 e 3. É por isso que o handler retorna erro 500 sem nunca conseguir extrair `vs1`.

Causa raiz: **o `fetch` do Cloudflare Workers não mantém cookies através de redirects automáticos**, e o fluxo da SafeConsig depende fortemente de `JSESSIONID` em cada hop.

Fatores agravantes que apareceriam mesmo se a Etapa 1 passasse:
- Cookie duplicado na concatenação Etapa1+Etapa2.
- Não há tratamento para resposta `<partial-response><redirect url="..."/></partial-response>` na Etapa 2 (só na 3).
- `Origin` header não é enviado (alguns servidores JSF exigem).
- Sem `Accept-Language`, `Accept-Encoding` razoáveis — o portal pode discriminar UA "headless".

## 4) Etapas do handler e onde quebra

```
Etapa 1: GET  /safe/login         → capturar ViewState vs1 + cookies1     ← LOOP ACONTECE AQUI
Etapa 2: POST /safe/login (AJAX)  → trigger "Esqueci Senha", obter vs2
Etapa 3: POST /safe/login (AJAX)  → enviar CPF, ler mensagens
```

Trecho relevante (linhas ~73-82 de `src/lib/safeconsig.functions.ts`):

```ts
const r1 = await fetch(LOGIN_URL, {
  headers: { "User-Agent": ua, Accept: "text/html" },
  redirect: "follow",        // ← deixa o Worker seguir até estourar
});
```

E na captura de erro (linhas ~144-152), o `err.cause` formatado bate exatamente com a mensagem observada:

```ts
return {
  status: "erro",
  message: `${err.message}${cause ? ` (causa: ${cause})` : ""}`,
};
// → "fetch failed (causa: redirect count exceeded)"
```

## Plano de correção (a aplicar depois)

1. **Trocar para `redirect: "manual"` nas três etapas** e implementar um mini "redirect follower" que:
   - Lê `Set-Cookie` de cada hop e acumula num **cookie jar** (dedupe por nome, último vence).
   - Reenvia o header `Cookie` consolidado no próximo hop.
   - Resolve `Location` relativo contra a URL anterior.
   - Limite de hops próprio (ex.: 5) com erro explícito.
2. **Tratar o caso "Etapa 1 redireciona para fora de `/safe/login`"**: se o GET resolver em outra página (ex.: `/safe/selecaoOrgaoGestor`), seguir até obter HTML com `javax.faces.ViewState`, ou abortar com mensagem clara ("portal exigiu seleção de órgão / fluxo mudou").
3. **Dedupe de cookies** entre Etapa 1 → 2 → 3 (não concatenar cru).
4. **Tratar `<redirect url="...">` também na Etapa 2**, não só na 3.
5. **Headers extras** mais realistas: `Origin: https://alagoas.safeconsig.com.br`, `Accept-Language: pt-BR,pt;q=0.9`, `Accept-Encoding: gzip`, `Connection: keep-alive`.
6. **Graceful degradation** (já parcialmente feito): manter o botão "Verificar manualmente" e, no erro de loop, exibir mensagem específica orientando o uso manual — em vez de "Erro desconhecido".
7. **Telemetria mínima**: logar status + `location` de cada hop dentro do follower para diagnóstico futuro (já temos `console.error`, falta granularidade).

Nenhum arquivo foi modificado. Pronto para implementar quando aprovado.
