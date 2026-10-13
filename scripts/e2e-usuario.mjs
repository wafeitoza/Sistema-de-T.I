#!/usr/bin/env node
/**
 * Cria/remove o usuário temporário do E2E de produção.
 *
 * Existe porque o E2E de produção (Fase F, item 19 — "0 erros E2E") precisa
 * de login real, e as senhas dos usuários de verdade são provisórias que
 * só o usuário conhece. A service_role (só no .env.local, gitignored)
 * cria uma conta descartável, amarra a `auth_id` (o RLS da Fase D exige
 * linha em public.usuarios para o login enxergar o perfil) e apaga tudo.
 *
 *   node scripts/e2e-usuario.mjs criar    → devolve { email, senha }
 *   node scripts/e2e-usuario.mjs apagar   → remove Auth + linha + dados criados
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const EMAIL = 'e2e-teste@empresa.com'
const SENHA = 'E2eteste-2026!'
const NOME = 'E2E Teste'

function carregarEnvLocal() {
  const caminho = resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local')
  let texto
  try {
    texto = readFileSync(caminho, 'utf8')
  } catch {
    return {}
  }
  const env = {}
  for (const linha of texto.split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1)
    env[t.slice(0, i).trim()] = v
  }
  return env
}

const doArquivo = carregarEnvLocal()
const URL = process.env.SUPABASE_URL || doArquivo.SUPABASE_URL || doArquivo.VITE_SUPABASE_URL
const CHAVE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  doArquivo.SUPABASE_SERVICE_ROLE_KEY ||
  doArquivo.SUPABASE_SECRET_KEY

if (!URL || !CHAVE) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (env ou .env.local).')
  process.exit(1)
}

const H = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' }
const REST = `${URL}/rest/v1`
const AUTH = `${URL}/auth/v1`

async function json(resposta) {
  const t = await resposta.text()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    return { mensagem: t }
  }
}

async function acharAuthId() {
  const r = await json(await fetch(`${AUTH}/admin/users?page=1&per_page=200`, { headers: H }))
  const lista = Array.isArray(r) ? r : (r?.users ?? [])
  return lista.find((u) => u.email?.toLowerCase() === EMAIL)?.id ?? null
}

async function criar() {
  // 1. conta no Auth — email_confirm para não cair no fluxo de confirmação
  //    (sem user_metadata.trocar_senha: a tela de troca travaria o E2E)
  const authId = await acharAuthId()
  let id = authId
  if (!id) {
    const r = await fetch(`${AUTH}/admin/users`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        email: EMAIL,
        password: SENHA,
        email_confirm: true,
        user_metadata: { nome: NOME },
      }),
    })
    const corpo = await json(r)
    if (!r.ok) {
      console.error('Falha ao criar conta Auth:', r.status, corpo?.msg ?? corpo?.message ?? corpo)
      process.exit(1)
    }
    id = corpo.id
  }

  // 2. linha em public.usuarios — sem ela o login cai em "Usuário não
  //    encontrado ou inativo" (perfilPor lê o espelho, que vem do RLS)
  // `usuarios` não tem coluna `id` (a chave é o e-mail): um `select=id` devolve
  // 42703 e um script ingênuo trataria o corpo de erro como "já existe",
  // pulando o insert em silêncio — o login depois cai em "Usuário não
  // encontrado". Por isso o filtro é por `email` e o status é checado.
  const consulta = await fetch(`${REST}/usuarios?select=email&email=eq.${encodeURIComponent(EMAIL)}`, { headers: H })
  const jaExiste = await json(consulta)
  if (!consulta.ok) {
    console.error('Falha ao consultar usuarios:', consulta.status, jaExiste)
    process.exit(1)
  }
  if (Array.isArray(jaExiste) && jaExiste.length === 0) {
    const r = await fetch(`${REST}/usuarios`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        email: EMAIL,
        nome: NOME,
        perfil: 'Admin',
        setor: 'TI',
        status: 'Ativo',
        auth_id: id,
      }),
    })
    if (!r.ok) {
      console.error('Falha ao criar linha em usuarios:', r.status, await json(r))
      process.exit(1)
    }
  }

  console.log(JSON.stringify({ email: EMAIL, senha: SENHA, auth_id: id }))
}

async function apagar() {
  // dados que o E2E criou (a auditoria é append-only por trigger: fica)
  for (const [tabela, filtro] of [
    ['estoque', `descricao=like.*E2E*`],
    ['ativos', `descricao=like.*E2E*`],
  ]) {
    const r = await fetch(`${REST}/${tabela}?${filtro}`, { method: 'DELETE', headers: H })
    const corpo = await json(r)
    if (!r.ok) console.error(`  ao limpar ${tabela}:`, r.status, corpo)
  }

  const id = await acharAuthId()
  if (id) {
    const r = await fetch(`${AUTH}/admin/users/${id}`, { method: 'DELETE', headers: H })
    if (!r.ok) console.error('  ao apagar conta Auth:', r.status, await json(r))
  }
  const r2 = await fetch(`${REST}/usuarios?email=eq.${encodeURIComponent(EMAIL)}`, {
    method: 'DELETE',
    headers: H,
  })
  if (!r2.ok) console.error('  ao apagar linha em usuarios:', r2.status, await json(r2))

  const sobrou = await acharAuthId()
  console.log(sobrou ? '⚠️ conta Auth ainda existe' : '✓ conta Auth e linha em usuarios removidas')
}

const acao = process.argv[2]
if (acao === 'criar') await criar()
else if (acao === 'apagar') await apagar()
else {
  console.error('Uso: node scripts/e2e-usuario.mjs criar|apagar')
  process.exit(1)
}
