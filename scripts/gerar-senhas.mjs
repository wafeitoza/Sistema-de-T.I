#!/usr/bin/env node
/**
 * Gera senhas provisórias para os usuários do sistema (Supabase Auth).
 *
 * Existe porque a troca de senha em massa não é uma operação do app:
 * aqui usamos a service_role (só no servidor/sua máquina) para redefinir
 * as contas de uma vez e marcar `trocar_senha = true`, de modo que a
 * primeira entrada obrigue o usuário a escolher a senha dele.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/gerar-senhas.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/gerar-senhas.mjs admin@empresa.com
 *
 * A chave também pode ficar em `.env.local` (gitignored) nas chaves
 * `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`.
 * As senhas NUNCA são gravadas em arquivo — só impressas na tela.
 */
import { readFileSync } from 'node:fs'
import { randomInt } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const EMAILS_PADRAO = [
  'admin@empresa.com',
  'gerente@empresa.com',
  'tecnico@empresa.com',
  'viewer@empresa.com',
]

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
    const trim = linha.trim()
    if (!trim || trim.startsWith('#')) continue
    const igual = trim.indexOf('=')
    if (igual < 1) continue
    const chave = trim.slice(0, igual).trim()
    let valor = trim.slice(igual + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    env[chave] = valor
  }
  return env
}

const doArquivo = carregarEnvLocal()
const URL = process.env.SUPABASE_URL || doArquivo.SUPABASE_URL || doArquivo.VITE_SUPABASE_URL
const CHAVE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  doArquivo.SUPABASE_SERVICE_ROLE_KEY ||
  doArquivo.SUPABASE_SECRET_KEY

if (!URL || !CHAVE) {
  console.error(
    'Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (env ou .env.local).\n' +
      'A service_role nunca vai para o bundle: ela existe só aqui e na Vercel Function.',
  )
  process.exit(1)
}

const cabecalho = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' }

function senhaProvisoria() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const numeros = '23456789'
  const tudo = letras + letras.toLowerCase() + numeros
  const pegar = (fonte, n) =>
    Array.from({ length: n }, () => fonte[randomInt(fonte.length)]).join('')
  return `Itstock-${pegar(letras, 2)}${pegar(numeros, 4)}${pegar(tudo, 4)}`
}

async function lerJson(resposta) {
  const texto = await resposta.text()
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return { mensagem: texto }
  }
}

async function principal() {
  const alvos = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const emails = alvos.length ? alvos : EMAILS_PADRAO

  const consulta = await fetch(
    `${URL}/rest/v1/usuarios?select=email,nome,auth_id&status=eq.Ativo`,
    { headers: cabecalho },
  )
  const linhas = await lerJson(consulta)
  if (!consulta.ok || !Array.isArray(linhas)) {
    console.error('Não foi possível ler a tabela usuarios:', consulta.status, linhas)
    process.exit(1)
  }
  const porEmail = new Map(linhas.map((l) => [String(l.email).toLowerCase(), l]))

  const resultados = []
  for (const email of emails) {
    const alvo = porEmail.get(email.toLowerCase())
    if (!alvo) {
      resultados.push({ email, ok: false, motivo: 'sem linha em public.usuarios' })
      continue
    }
    if (!alvo.auth_id) {
      resultados.push({ email, ok: false, motivo: 'usuário ainda não tem conta no Auth' })
      continue
    }

    const senha = senhaProvisoria()
    const resposta = await fetch(`${URL}/auth/v1/admin/users/${alvo.auth_id}`, {
      // GoTrue aceita PUT (PATCH devolve 405)
      method: 'PUT',
      headers: cabecalho,
      body: JSON.stringify({
        password: senha,
        email_confirm: true,
        user_metadata: { nome: alvo.nome, trocar_senha: true },
      }),
    })
    if (!resposta.ok) {
      const erro = await lerJson(resposta)
      resultados.push({ email, ok: false, motivo: `${resposta.status} ${erro?.msg ?? erro?.message ?? ''}` })
      continue
    }
    resultados.push({ email, ok: true, senha })
  }

  const falhas = resultados.filter((r) => !r.ok)
  const largura = Math.max(...resultados.map((r) => r.email.length), 5)
  console.log('\nSenhas provisórias (valem só até o primeiro login):\n')
  for (const r of resultados) {
    if (r.ok) console.log(`  ${r.email.padEnd(largura)}  ${r.senha}`)
    else console.log(`  ${r.email.padEnd(largura)}  FALHOU — ${r.motivo}`)
  }
  console.log(
    '\nTodas ficaram marcadas para trocar a senha na primeira entrada.' +
      (falhas.length ? `\n${falhas.length} falha(s).` : ''),
  )
  process.exit(falhas.length ? 1 : 0)
}

await principal()
