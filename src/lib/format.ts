export function formatarMoeda(valor?: number): string {
  if (valor === undefined || Number.isNaN(valor)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

export function formatarData(valor?: string): string {
  if (!valor) return '—'
  // Datas já vêm no formato BR (DD/MM/AAAA) quando editáveis no sistema.
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) return valor
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor
  return d.toLocaleDateString('pt-BR')
}

export function hojeBR(): string {
  return new Date().toLocaleDateString('pt-BR')
}

export function agoraISO(): string {
  return new Date().toISOString()
}

export function paraISO(dataBR: string): string {
  const [dia, mes, ano] = dataBR.split('/')
  if (!dia || !mes || !ano) return dataBR
  return `${ano}-${mes}-${dia}T12:00:00`
}

export function dataBRparaDate(dataBR: string): Date | null {
  const iso = paraISO(dataBR)
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function diasAte(dataBR: string): number | null {
  const alvo = dataBRparaDate(dataBR)
  if (!alvo) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

export function somarDiasBR(dataBR: string, dias: number): string {
  const base = dataBRparaDate(dataBR) ?? new Date()
  base.setDate(base.getDate() + dias)
  return base.toLocaleDateString('pt-BR')
}

export function saudacao(data: Date = new Date()): string {
  const hora = data.getHours()
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function formatarNumeroBR(valor: number | undefined | null): string {
  if (valor === undefined || valor === null || Number.isNaN(valor)) return ''
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function parseMoeda(texto: string): number | undefined {
  const bruto = texto.replace(/R\$/gi, '').replace(/\s/g, '').trim()
  if (!bruto) return undefined
  let normal = bruto
  if (normal.includes(',')) {
    normal = normal.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normal)) {
    normal = normal.replace(/\./g, '')
  }
  const n = Number(normal)
  return Number.isFinite(n) ? n : undefined
}
