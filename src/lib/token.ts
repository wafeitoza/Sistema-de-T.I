const SEGREDO = 'IT-STOCK-MVP-2026'
const VALIDADE_DIAS = 7

function assinar(texto: string): string {
  let h = 0x811c9dc5
  const entrada = `${SEGREDO}|${texto}`
  for (let i = 0; i < entrada.length; i++) {
    h ^= entrada.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

function base64url(texto: string): string {
  return btoa(unescape(encodeURIComponent(texto)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function deBase64url(texto: string): string {
  const complemento = texto.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(complemento)))
}

export interface TokenAprovacao {
  token: string
  expiraEm: string
}

export function gerarTokenAprovacao(
  idSolicitacao: string,
  aprovador: string,
): TokenAprovacao {
  const emitido = Date.now()
  const expira = emitido + VALIDADE_DIAS * 86_400_000
  const payload = `${idSolicitacao}|${aprovador}|${emitido}|${expira}`
  const token = `${base64url(payload)}.${assinar(payload)}`
  return { token, expiraEm: new Date(expira).toISOString() }
}

export interface ResultadoValidacao {
  valido: boolean
  motivo?: string
  idSolicitacao?: string
  aprovador?: string
}

export function validarTokenAprovacao(token: string): ResultadoValidacao {
  const partes = token.split('.')
  if (partes.length !== 2) return { valido: false, motivo: 'Token malformado' }

  let payload: string
  try {
    payload = deBase64url(partes[0])
  } catch {
    return { valido: false, motivo: 'Token inválido' }
  }

  if (assinar(payload) !== partes[1]) {
    return { valido: false, motivo: 'Assinatura inválida' }
  }

  const [idSolicitacao, aprovador, , expira] = payload.split('|')
  if (Number(expira) < Date.now()) {
    return { valido: false, motivo: 'Link expirado (validade de 7 dias)' }
  }

  return { valido: true, idSolicitacao, aprovador }
}

export function montarLinkAprovacao(token: string): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  return `${base}/aprovacao/${token}`
}
