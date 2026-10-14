/**
 * Erros de produção — Fase E, item 15.
 *
 * O Sentry só liga se `VITE_SENTRY_DSN` existir. Sem ela o sistema continua
 * exatamente como estava: erro no console e na aba Auditoria. Assim o
 * repositório não fica esperando a conta ser criada — quem for implantar
 * só cola a DSN e acende.
 *
 * **LGPD**: o sistema guarda nome, e-mail, setor e telefone de servidores.
 * Por isso a identidade NUNCA vai para o Sentry — nenhum `setUser` em lugar
 * algum, e o `beforeSend` descarta `request` (URL, headers, cookies) e
 * `user` de todo evento, mesmo que o SDK venha a preencher sozinho algum dia.
 */
import type { ErrorEvent } from '@sentry/react'

let sdk: typeof import('@sentry/react') | null = null

/**
 * Inicializa o SDK se houver DSN. Nunca derruba o boot — a falha vira log e
 * o sistema segue com o comportamento antigo.
 *
 * A DSN é lida aqui dentro e não no topo do módulo: assim o valor é
 * consultado no momento do boot (e não na hora do import), o que também
 * torna o comportamento testável sem reiniciar o módulo.
 */
export async function iniciarErros(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  try {
    const modulo = await import('@sentry/react')
    modulo.init({
      dsn,
      environment: 'producao',
      // Só exceções. Traçar performance custaria bundle e latência para um
      // sistema interno de 2–10 usuários.
      tracesSampleRate: 0,
      // A proteção de LGPD mora aqui, e não em uma flag do SDK: todo evento
      // sai sem `request` (URL, headers, cookies) e sem `user` (nome, e-mail),
      // mesmo que o passe a preencher sozinho numa versão futura.
      beforeSend(event: ErrorEvent): ErrorEvent {
        delete event.request
        delete event.user
        return event
      },
    })
    sdk = modulo
  } catch (erro) {
    console.error('sentry:', erro)
  }
}

/** Reporta um erro se o Sentry estiver ligado; no-op caso contrário. */
export function reportarErro(erro: unknown, contexto?: Record<string, unknown>): void {
  if (!sdk) return
  sdk.captureException(erro, contexto ? { extra: contexto } : undefined)
}

/** `true` quando o SDK está ativo — a UI pode usar para dizer "já reportado". */
export function errosAtivos(): boolean {
  return sdk !== null
}
