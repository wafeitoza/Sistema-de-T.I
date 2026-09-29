const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DATA_RE = /^\d{2}\/\d{2}\/\d{4}$/
const CODIGO_RE = /^[A-Z]{3,4}-\d{3}$/

export function validarEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

export function validarData(data: string): boolean {
  if (!DATA_RE.test(data)) return false
  const [dia, mes, ano] = data.split('/').map(Number)
  const d = new Date(ano, mes - 1, dia)
  return (
    d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia
  )
}

export function validarCodigoAtivo(codigo: string): boolean {
  return CODIGO_RE.test(codigo.trim())
}

export function validarNumeroPositivo(valor: number): boolean {
  return Number.isFinite(valor) && valor > 0
}

export function obrigatorio(valor: string | undefined): boolean {
  return !!valor && valor.trim().length > 0
}

export function errosAtivo(campos: {
  descricao: string
  tipo: string
  setor: string
  responsavel: string
  dataAquisicao: string
}): Record<string, string> {
  const erros: Record<string, string> = {}
  if (!obrigatorio(campos.descricao)) erros.descricao = 'Descrição é obrigatória'
  if (!obrigatorio(campos.tipo)) erros.tipo = 'Tipo é obrigatório'
  if (!obrigatorio(campos.setor)) erros.setor = 'Setor é obrigatório'
  if (!validarEmail(campos.responsavel)) erros.responsavel = 'E-mail inválido'
  if (!validarData(campos.dataAquisicao)) erros.dataAquisicao = 'Use o formato DD/MM/AAAA'
  return erros
}
