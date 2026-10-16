/**
 * Sincronização agendada — só executa no servidor da Vercel.
 *
 * GET /api/cron-sincronizar   (a cada 5 min, pelo workflow
 *                              `.github/workflows/chamados-sync.yml`)
 *
 * Por que existe: a importação antes dependia de um Admin/Gerente/Técnico
 * abrir a tela e clicar em "Sincronizar agora". Um chamado que chega de
 * madrugada ou num feriado ficava invisível até alguém entrar — justamente
 * quando o tempo de resposta mais pesa. Com o gatilho agendado, o e-mail que
 * chega na caixa conectada vira chamado sozinho em minutos.
 *
 * O agendador é o GitHub Actions e não o Vercel Cron porque o plano free da
 * Vercel roda cron no máximo 1x/dia; o repo é público e o Actions agendado é
 * gratuito e ilimitado.
 *
 * Autenticação: o workflow envia `Authorization: Bearer ${CRON_SECRET}` — o
 * MESMO valor da env var `CRON_SECRET` na Vercel (Settings → Environment
 * Variables). Sem a env var configurada o endpoint recusa tudo (fechado por
 * padrão) — não pode existir um caminho público que dispare leitura de caixa
 * e escrita no banco.
 *
 * O ator auditado é `sistema`, não um usuário: não há sessão de humano aqui.
 * A dedupe do banco (índices únicos em `email_id`) protege contra corrida
 * com o botão "Sincronizar agora" — os dois gatilhos podem rodar no mesmo
 * minuto sem duplicar chamado.
 */
import { config, googleConfig } from './_lib.mjs'
import { sincronizar } from './_gmail.mjs'

/** O cron não tem usuário; `registrado_por`/`auditoria.usuario` aceitam texto. */
const CHAMADOR_DE_SISTEMA = { email: 'sistema' }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    console.error('[api/cron-sincronizar] CRON_SECRET ausente — recusando execução')
    return res.status(500).json({ erro: 'CRON_SECRET não configurado' })
  }

  const recebido = (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : ''
  if (!recebido || recebido !== segredo) {
    // o mesmo caminho exposto na web não pode ser acionado por terceiros
    return res.status(401).json({ erro: 'Não autorizado' })
  }

  const cfg = config()
  if (cfg.erro) return res.status(500).json({ erro: cfg.erro })

  const google = googleConfig()
  if (google.erro) return res.status(500).json({ erro: google.erro })

  try {
    const r = await sincronizar(cfg, google, CHAMADOR_DE_SISTEMA)
    if (r.status !== 200) {
      // 400 = ninguém conectou a caixa ainda; 401 = autorização expirou.
      // Ambos são esperados antes da primeira conexão e não devem virar
      // alerta de falha de cron a cada 5 minutos.
      console.warn('[api/cron-sincronizar] sem importação:', r.status, r.corpo?.erro ?? '')
    }
    return res.status(r.status).json({ ...r.corpo, origem: 'cron' })
  } catch (erro) {
    console.error('[api/cron-sincronizar] erro inesperado:', erro)
    return res.status(500).json({ erro: 'Erro interno na sincronização automática' })
  }
}
