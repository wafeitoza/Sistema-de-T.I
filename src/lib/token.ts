/**
 * RN004 — link de aprovação de solicitações.
 *
 * Fase D: o token deixou de ser um HMAC client-side (FNV-1a de 32 bits com
 * segredo hardcoded, forjável e exposto no bundle) e passou a ser um **UUID
 * aleatório** guardado em `solicitacoes.aprovacao_token`. Possuir o UUID é a
 * capacidade de decidir — validação e escrita acontecem no banco
 * (RPCs `solicitacao_por_token` / `decidir_por_token`, migrations da Fase D).
 *
 * No modo local (sem Supabase) a validação é feita contra o espelho do
 * navegador: não há servidor, e ali não existe segredo a proteger.
 */
const VALIDADE_DIAS = 7

const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** RFC 4122 v4 — `crypto.randomUUID` quando existe, com fallback. */
function uuid(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  )
}

export interface TokenAprovacao {
  token: string
  expiraEm: string
}

/** Gera o token do link (o id e o aprovador ficam só no banco, não na URL). */
export function gerarTokenAprovacao(): TokenAprovacao {
  const expira = Date.now() + VALIDADE_DIAS * 86_400_000
  return { token: uuid(), expiraEm: new Date(expira).toISOString() }
}

export interface ResultadoValidacao {
  valido: boolean
  motivo?: string
}

/**
 * Checagem de forma do token. Quem confere existência, prazo e status é o
 * banco (ou, no modo local, a store) — este função só evita uma chamada
 * óbvia com uma URL truncada.
 */
export function validarTokenAprovacao(token: string): ResultadoValidacao {
  if (!RE_UUID.test(token)) {
    return { valido: false, motivo: 'Token malformado' }
  }
  return { valido: true }
}

export function montarLinkAprovacao(token: string): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  return `${base}/aprovacao/${token}`
}
