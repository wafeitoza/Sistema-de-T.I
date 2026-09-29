export const PREFIXOS: Record<string, string> = {
  Notebook: 'NOTE',
  Monitor: 'MON',
  'CPU/Computador': 'CPU',
  Teclado: 'TEC',
  Mouse: 'MOU',
  Webcam: 'WEB',
  'Fone/Headset': 'FON',
  Impressora: 'IMP',
  Scanner: 'SCA',
  Roteador: 'ROT',
  Switch: 'SWI',
  Nobreak: 'NOB',
  Cabo: 'CAB',
  Adapter: 'ADA',
}

export const TIPOS_ATIVO = Object.keys(PREFIXOS)

export const SETORES = [
  'Administrativo',
  'Financeiro',
  'Recursos Humanos',
  'TI',
  'Vendas',
  'Operacional',
  'Diretoria',
]

export const CATEGORIAS_ESTOQUE = [
  'Cables',
  'Periféricos',
  'Consumíveis',
  'Componentes',
  'Acessórios',
  'Baterias',
  'Memória',
  'Armazenamento',
]

export const UNIDADES = ['Peça', 'Caixa', 'Metro', 'Kit', 'Unidade']

function prefixoDe(tipo: string): string {
  return PREFIXOS[tipo] ?? tipo.slice(0, 3).toUpperCase()
}

export function proximoCodigoAtivo(tipo: string, existentes: string[]): string {
  const prefixo = prefixoDe(tipo)
  let maior = 0
  for (const codigo of existentes) {
    if (!codigo.startsWith(`${prefixo}-`)) continue
    const n = Number.parseInt(codigo.slice(prefixo.length + 1), 10)
    if (!Number.isNaN(n) && n > maior) maior = n
  }
  return `${prefixo}-${String(maior + 1).padStart(3, '0')}`
}

export function proximoCodigoItem(existentes: string[]): string {
  let maior = 0
  for (const codigo of existentes) {
    const n = Number.parseInt(codigo.replace(/^Item-/i, ''), 10)
    if (!Number.isNaN(n) && n > maior) maior = n
  }
  return `Item-${String(maior + 1).padStart(3, '0')}`
}

export function gerarId(prefixo: string, sequencia: number, ano = new Date().getFullYear()): string {
  return `${prefixo}-${ano}-${String(sequencia).padStart(6, '0')}`
}

export function urlQRCode(texto: string): string {
  return `https://quickchart.io/qr?text=${encodeURIComponent(texto)}&size=200&dark=111827`
}
