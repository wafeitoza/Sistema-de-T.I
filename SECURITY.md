# Segurança

O que foi testado, como foi testado, o que passou e o que continua em aberto.
Este arquivo é a evidência — qualquer afirmação aqui remete a um teste que rodou
em produção e pode ser reproduzido.

**Última varredura completa: 15/10/2026.**

---

## Como o teste foi feito

Regras que valem para a bateria inteira:

- **Produção** (`https://it-stock-react.vercel.app`), não homologação — o que
  interessa é o sistema real.
- **Só contas descartáveis**, criadas por `service_role` com sufixo `seg-*` e
  apagadas ao final. Nenhum dado real foi lido, alterado ou removido.
- **Nenhuma chave sai da máquina**: os scripts leem `.env.local` e só imprimem
  status e mensagens de erro.
- **Limpeza verificada, não presumida.** Durante os testes surgiu a dúvida de
  que o filtro `email=like.*seg-*` não fosse curinga (e que "0 resíduos"
  significasse apenas "o padrão não casou com nada"). Isso foi **testado e
  refutado**: no PostgREST, `like.*@empresa.com` devolve a linha real e
  `ilike.*EMPRESA.com` também, ou seja `*` é convertido para `%` — o padrão
  estava certo e a primeira verificação já era válida. Ainda assim, a checagem
  final foi refeita listando `usuarios` e `auth.users` **por inteiro** e filtrando
  no cliente, que é a forma que não depende de nenhuma semântica de filtro:
  **0 resíduos**.
- **Linhas de auditoria geradas pelos testes permanecem.** A `auditoria` é
  append-only por desenho (trigger bloqueia UPDATE/DELETE) e seria
  contraditório apagar a própria trilha num teste de segurança. Regras de teste
  aparecem com e-mails `seg-*`.

---

## Resultado por domínio

| Domínio | Escopo | Resultado |
| --- | --- | --- |
| **A** | Superfície externa só com a chave publicável (papel `anon`) | **12/12** |
| **B** | Escalada de privilégio entre perfis logados (produção) | **11/11** + 2 achados |
| **C** | Acesso sem autenticação em `/api/usuarios` | **13/13** |
| **C2** | Permissões no endpoint de gestão de usuários | (inserido em B) |
| **D** | Link público de aprovação `/aprovacao/:token` | **14/14** |
| **E** | Segredos no bundle, dependências, cabeçalhos | **0 segredos · 0 CVE · cabeçalhos corrigidos** |
| **F** | Autenticação: enumeração, força bruta, senha provisória | **8/8** |

---

## Achados

### F-1 · A API de gestão de contas não deixava rastro — **MÉDIO** · corrigido

**O quê.** `POST /api/usuarios` executa criar, redefinir e excluir com a
`service_role` no servidor, e era alcançável direto por qualquer portador de
token de Admin válido — sem passar pela tela. Mas só o navegador gravava na
`auditoria`. Quem chamasse a Function por fora fazia e desfazia conta em silêncio.

**Como foi reproduzido.** Conta Admin descartável logada, `POST /api/usuarios`
com `acao: "criar"` → `200`; mesma chamada com `acao: "excluir"` → `200`; a
tabela `auditoria` ficou **exatamente igual** antes e depois. Os 124 registros
existentes eram todos `LOGIN`/`LOGOUT`, vindos do caminho do navegador.

**Por que importa.** Sem linha de auditoria não existe investigação: não dá
para saber quem criou uma conta de acesso nem quando ela foi apagada.

**Correção.** `afe25de` — a gravação saiu do servidor e cobre os três caminhos,
mais dois casos que valem mais que os acertos: **tentativa negada** (conta
válida sem perfil Admin) e **exceção não tratada**. A senha provisória fica de
fora dos campos auditados de propósito.

**Conferido em produção: 18/18.** `CREATE/Sucesso` com o e-mail de quem fez,
`DELETE/Sucesso`, tentativa negada gravada como `acesso negado — perfil
Visualizador, status Ativo`, e a senha ausente dos campos.

---

### F-2 · A senha provisória só era obrigatória na tela — **MÉDIO** · corrigido

**O quê.** `trocar_senha: true` é gravado em quem é criado e em quem tem a
senha redefinida, e a tela responde com um modal que não fecha. Tudo isso roda
no navegador de quem está logado — não impede ninguém.

**Como foi reproduzido.** Conta Admin descartável com `trocar_senha: true`
no `user_metadata`, logada, chamou `POST /api/usuarios` direto → **`200`, sem
nenhuma reclamação**. Na prática, quem recebia a senha provisória continuava
criando e apagando conta por `curl` sem nunca trocar a senha.

**Por que importa.** A política de rotação de senha valia só para quem usasse a
interface. Um link com a provisória que vazasse por chat ou planilha continuava
dando acesso administrativo indefinidamente, sem que a troca fosse imposta.

**Correção.** `71d0c47` — `perfilDoToken` passa a trazer a marca do
`user_metadata` e o handler recusa antes de executar qualquer ação, com `403`
próprio (não o `401` de "sessão inválida", que seria enganoso: a sessão é
válida, é a senha que não foi trocada). A recusa também é auditada.

**Conferido em produção: 8/8**, com a linha
`senha provisória ainda não trocada — gestão recusada` presente na auditoria.

---

### F-3 · O site saía sem cabeçalhos de segurança — **MÉDIO** · corrigido

**O quê.** Só havia HSTS. Faltava CSP, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`.

**Por que importa.** Sem `frame-ancestors`, qualquer página da internet podia
embeber o sistema num iframe (sequestro de clique sobre a tela de login). Sem
CSP não havia trava contra injeção de script.

**Correção.** `6b5db3b` — `vercel.json` com CSP restrita (`script-src` só
`'self'`; o build não tem nenhum script inline, então não precisa de
`unsafe-inline` nem `unsafe-eval`), `frame-ancestors 'none'`,
`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
`Permissions-Policy`, `COOP` e `CORP`.

**Conferido: 12/12**, servindo o `dist` localmente com os mesmos headers do
`vercel.json`. Os domínios que o app usa foram testados um a um — Google Fonts
(folha de estilo do `index.html`), `quickchart.io` (QR dos ativos),
`open-meteo.com` e `api.bigdatacloud.net` (previsão), `*.supabase.co` (a API).

> Foi o teste local que pegou o Google Fonts faltando, antes do deploy. Um
> cabeçalho quebrado em produção é uma tela branca para o usuário; por isso os
> **controles negativos** — domínio fora da lista recusado em `connect`, `img` e
> `script`, e iframe de outra origem recusado por `frame-ancestors`. Sem esses
> controles, uma CSP ignorada pelo navegador passaria "verde" sem impor nada.

---

### F-4 · Qualquer usuário logado lê a tabela `usuarios` inteira — **MÉDIO** · **em aberto**

**O quê.** Um Visualizador lê todas as linhas de `usuarios`: e-mail, nome,
perfil, setor, status — e também **telefone e foto** (`src/types/index.ts`).

**Como foi reproduzido.** Conta Visualizador descartável, logada: ler outra
linha → `200` com 1 registro; listar tudo → 3 registros, 2 de terceiros;
filtrar `perfil=Admin` → 2 registros. Um INSERT na mesma tabela foi negado, ou
seja, o RLS de **escrita** funciona — o de **leitura** é que é aberto.

**Causa raiz.** `supabase/migrations/20261007010000_rls_por_perfil.sql`,
linhas 157-174: o bloco *"Leitura: qualquer autenticado nas tabelas de
negócio"* itera sobre 14 tabelas e **`usuarios` é a primeira da lista**, criando
`usuarios_leitura` com `for select to authenticated using (true)`. É decisão
registrada no comentário, não um descuido — mas trata `usuarios` como tabela de
negócio comum.

**Por que ainda está em aberto.** A leitura aberta é **carregada por
funcionalidade**: o seletor de aprovador das solicitações
(`SolicitacaoFormModal`) é usado por **Visualizador** e depende da lista de
Admin/Gerente; `ManutencaoPage` e `BuscaGlobal` usam a mesma lista. Restringir
a leitura para "linha própria + `pode_gerenciar()`" **quebra a criação de
solicitação para o perfil Visualizador**. Isso é decisão de produto, não de
segurança — e por isso não foi feito por conta própria.

**Direção sugerida** (por ordem de custo):

1. **Migrar `telefone`/`foto` para `usuarios_contato`** com leitura restrita a
   `pode_gerenciar()` ou à própria linha. Resolve o ponto que é LGPD de fato
   (telefone de colega) **sem quebrar nenhum seletor**, porque `usuarios` segue
   legível só com colunas inócuas. Custo: migration + ajuste em `UsuariosPage`
   e `ConfiguracoesPage`.
2. **Restringir a linha inteira** e expor um RPC `diretorio()` com
   `email, nome, perfil, status` para os seletores. Mais correto, mais caro
   (toca o carregamento em `carregarTudo`).

**Ambas exigem migration aplicada em produção antes do push** — ver
"Pendências" abaixo.

---

### F-5 · Decisão via link é atribuída ao aprovador designado — **BAIXO** · **em aberto**

**O quê.** `decidir_por_token` grava na auditoria
`coalesce(v.aprovador, 'link@aprovacao')` como `usuario`. Como `aprovador` é
`NOT NULL`, o `coalesce` nunca cai no fallback — então **toda** decisão feita
pelo link público é registrada como se tivesse sido do aprovador designado,
mesmo quando foi um terceiro com a URL em mãos.

**Como foi reproduzido.** Solicitação descartável decidida anonimamente; a
linha saiu com `usuario = seg-descartavel@empresa.com` (o aprovador) e a
mensagem `Decisão via link assinado (aprovar)`.

**Impacto.** A mensagem já denuncia que veio do link, mas a coluna
`usuario` — usada em filtros e relatórios de responsabilidade — nomeia a pessoa
errada. Num incidente, o log apontaria o aprovador por uma ação que ele não fez.

**Correção sugerida.** Trocar a mensagem para algo explícito, por exemplo
`Decisão via link público — não autenticado (aprovador indicado: <email>)`.
**Requer migration** na RPC `decidir_por_token`.

---

### F-6 · Fallback do token de aprovação usa `Math.random` — **INFORMATIVO**

`src/lib/token.ts` usa `crypto.randomUUID()` e, na falta,
`crypto.getRandomValues()` — ambos CSPRNG. Só num terceiro nível, se nenhum dos
dois existir, cai em `Math.random()`.

**Não é explorável em produção**: `getRandomValues` exige contexto seguro e o
sitio é HTTPS, logo o terceiro caminho é inatingível. Fica registrado porque é
o tipo de coisa que vira problema se o sistema um dia rodar em HTTP.

---

### F-7 · RPC do link público não tem limite de tentativas — **INFORMATIVO**

30 chamadas a `solicitacao_por_token` com UUIDs inventados → `200`, nenhum
`429`. Não há trava própria no RPC.

**Aceitável, mas com uma condição**: a segurança aqui depende inteiramente da
entropia do UUID (2¹²²). Se um dia o gerador regredir, deixar de existir trava
vira problema — por isso F-6 e este item devem ser lidos juntos.

O **login**, ao contrário, **tem** trava: a do próprio Supabase Auth. Medido —
40 senhas erradas em 9,5 s dispararam `429` na 32ª tentativa, e a trava liberou
em ~15 s. Nem permanente (bom: não deixa ninguém trancado) nem inexistente.

---

### F-8 · Backup agendado não comprovado — **MÉDIO** (continuidade, não ataque) · **em aberto**

A execução **agendada** de 12/10 falhou (workflow antigo, step
`pg_dump · criptografa · guarda`, exit 1); a de 13/10 foi **manual** e deu
certo. O teste de restauração em Postgres 17 descartável passou, então o
procedimento funciona — o que não está provado é o **agendamento**.

Próxima execução agendada: **segunda, 19/10/2026, 06:30 UTC**. Se ela falhar,
é para investigar antes de qualquer perda.

---

## O que passou (e é sólido)

- **A (anon, 12/12)** — as 16 tabelas devolvem `401` com `42501` "Grant the
  required privileges": erro de **privilégio** do Postgres, não RLS filtrando
  linha. É o `revoke all ... from anon` valendo — e como o `revoke all` tira
  SELECT e INSERT na mesma sentença, escrita está negada no mesmo nível.
  `DELETE` com filtro impossível confirmou `401/403` em 16/16. RPCs de sequência
  fora do alcance do `anon`; a chave publicável não vale como sessão.
- **C (sem sessão, 13/13)** — método travado (`405` + `Allow: POST`), token
  ausente/lixo/forgado/com assinatura corrompida/assinado porém expirado → todos
  `401`; **a chave publicável é rejeitada como sessão**; a autenticação corre
  antes de qualquer lógica; nenhum detalhe interno vaza.
- **B (escalada, 11/11)** — Visualizador, Gerente e Técnico → `403` na API;
  Admin Inativo → `403`; autoexclusão → `400`; alvo inexistente → `404`;
  Visualizador com INSERT em `usuarios` → negado (RLS de escrita funciona).
- **D (link de aprovação, 14/14)** — token é UUID v4 (122 bits, variante RFC
  4122); devolve **só a própria linha**; inventado → `null` (não enumera);
  expirado não lê nem decide; a decisão anônima grava auditoria; **replay
  recusado** ("já foi decidida") tanto para rejeitar quanto para aprovar de
  novo; ação fora de `aprovar`/`rejeitar` recusada; token malformado devolve
  `400` sem vazar função nem SQL.
- **E (segredos, 0)** — nenhum `service_role`, JWT ou segredo de backup em
  1137 KB de bundle; `npm audit` 0 vulnerabilidades.
- **F (autenticação, 8/8)** — e-mail inexistente e senha errada respondem
  **idêntico** (`400` / `invalid_credentials` / "Invalid login credentials"),
  ou seja, não há enumeração de usuário; força bruta é interceptada por `429`
  temporário; e a senha provisória agora é imposta no servidor.

---

## Como reproduzir

Os scripts ficam fora do repositório (contêm a lógica de contas descartáveis)
e rodam apontando para produção:

```bash
node /tmp/opencode/seg/testa-superficie-anon.mjs   # A · anon
node /tmp/opencode/seg/testa-auditoria-api.mjs      # F-1 · auditoria da API
node /tmp/opencode/seg/testa-link-aprovacao.mjs     # D · link de aprovação
node /tmp/opencode/seg/testa-autenticacao.mjs       # F · enumeração/força bruta/senha provisória
node /tmp/opencode/testa-csp.mjs                    # F-3 · CSP (servindo o dist local)
node /tmp/opencode/seg/verifica-limpeza.mjs         # limpeza: 0 resíduos seg-*
```

Todos leem `.env.local` e **nunca imprimem chave**. Os de produção criam e apagam
contas descartáveis no `finally`; o de CSP precisa do build local e do Chrome
com `--remote-debugging-port=9225`.

---

## Pendências

| Item | Bloqueio | Quem decide |
| --- | --- | --- |
| **F-4** — escopo da leitura de `usuarios` (telefone/foto é LGPD) | Tem custo funcional real (quebra o seletor de aprovador) e exige migration | Decisão de produto |
| **F-5** — atribuição da decisão via link | Exige migration na RPC | Simples, assim que houver acesso ao banco |
| **F-8** — provar o backup agendado | Execução de 19/10 06:30 UTC | Verificação |
| Sentry (item 15) | Precisa da conta/DSN | Usuário |
| Sensores e contas de teste | Só existe **1** login utilizável em produção | Usuário |

**Migration antes do deploy.** Toda correção que mexe em SQL precisa ser
aplicada na produção **antes** do push, porque a Vercel faz deploy automático ao
ir para `main` — o que exige um `supabase login` local. O PAT existente está
apenas como segredo do GitHub Actions e **não deve ser revogado**: o backup
semanal depende dele.
