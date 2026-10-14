import type { Ativo, Termo } from '../types'
import { hojeBR } from './format'
import { sha256Hex } from './hash'

export function montarPayload(t: Termo): string {
  return JSON.stringify({
    ativoCodigo: t.ativoCodigo,
    responsavel: t.responsavel,
    conteudo: t.conteudo,
    criadoEm: t.criadoEm,
    criadoPor: t.criadoPor,
  })
}

export async function calcularHashTermo(t: Termo): Promise<string> {
  return sha256Hex(montarPayload(t))
}

export async function integridadeOK(t: Termo): Promise<boolean> {
  if (!t.hash) return false
  return (await calcularHashTermo(t)) === t.hash
}

export function conteudoPadrao(ativo: Ativo, responsavel: string): string {
  const modelo = [ativo.marca, ativo.modelo].filter(Boolean).join(' ')
  return [
    'TERMO DE RESPONSABILIDADE PELO ATIVO DE T.I.',
    '',
    `Eu, ${responsavel}, assumo a responsabilidade pelo uso do ativo ${ativo.codigo} — ${ativo.descricao}${modelo ? ` (${modelo})` : ''}, sob minha guarda no setor ${ativo.setor}, comprometendo-me a:`,
    '',
    '1. utilizar o equipamento apenas para finalidades laborais;',
    '2. comunicar imediatamente qualquer dano, extravio ou mau funcionamento;',
    '3. devolver o ativo em caso de transferência, desligamento ou descarte.',
    '',
    `Local: Salvador/BA — Data: ${hojeBR()}`,
  ].join('\n')
}

// -----------------------------------------------------------------------------
// Termo de empréstimo — gerado junto com o registro do empréstimo.
//
// Só entra no texto o que NUNCA muda depois de criado o empréstimo (ativo,
// funcionário, setor, matrícula, datas). Isso é de propósito: o texto pode ser
// remontado a qualquer momento a partir do empréstimo e o SHA-256 continua
// batendo — então "imprimir de novo" não depende de achar o registro antigo.
// -----------------------------------------------------------------------------

export interface DadosTermoEmprestimo {
  codigoAtivo: string
  descricao: string
  tipo: string
  marca?: string
  modelo?: string
  serial?: string
  tombamento?: string
  setor: string
  funcionario: string
  matricula?: string
  dataEmprestimo: string
  previsaoDevolucao: string
}

const LINHA_ASSINATURA = '__________________________________________'

function linhaRotulo(rotulo: string, valor?: string): string | null {
  const v = valor?.trim()
  return v ? `${rotulo}: ${v}` : null
}

export function conteudoTermoEmprestimo(d: DadosTermoEmprestimo): string {
  const modelo = [d.marca, d.modelo].filter(Boolean).join(' ')
  const matricula = d.matricula?.trim()
  const secao = [
    'IDENTIFICACAO DO EQUIPAMENTO',
    // o tipo de equipamento vem primeiro: é o dado principal do termo
    linhaRotulo('Tipo de equipamento', d.tipo),
    linhaRotulo('Codigo', d.codigoAtivo),
    linhaRotulo('Descricao', d.descricao),
    linhaRotulo('Marca/modelo', modelo),
    linhaRotulo('Numero de serie', d.serial),
    linhaRotulo('Tombamento', d.tombamento),
  ]
    .filter((l): l is string => !!l)
    .join('\n')

  return [
    'TERMO DE RESPONSABILIDADE POR EMPRESTIMO DE EQUIPAMENTO',
    '',
    `Eu, ${d.funcionario}${matricula ? `, matricula nº ${matricula}` : ''}, do setor ${d.setor}, recebo da area de T.I. o equipamento abaixo identificado, para uso proprio, pelo prazo indicado a seguir.`,
    '',
    secao,
    '',
    'PRAZO',
    `Data do emprestimo: ${d.dataEmprestimo}`,
    `Previsao de devolucao: ${d.previsaoDevolucao}`,
    '',
    'COMPROMISSOS',
    '',
    '1. utilizar o equipamento apenas para finalidades laborais;',
    '2. zelar pelo equipamento e mante-lo sob minha guarda;',
    '3. comunicar imediatamente a T.I. qualquer dano, extravio, furto ou mau funcionamento;',
    '4. devolver o equipamento no prazo indicado, ou assim que solicitado pela T.I.;',
    '5. arcar com os custos de reparo quando o dano resultar de uso inadequado.',
    '',
    'Declaro ciente de que o equipamento continua pertencendo a empresa e de que a ausencia de devolucao no prazo sera tratada conforme a politica interna.',
    '',
    LINHA_ASSINATURA,
    `${d.funcionario} — responsavel`,
    '',
    LINHA_ASSINATURA,
    'T.I. — entrega',
    '',
    `Local: Salvador/BA — Data: ${d.dataEmprestimo}`,
  ].join('\n')
}

/**
 * Os campos do empréstimo que entram no termo. `Emprestimo` satisfaz este
 * formato, mas também aceitamos o formulário ainda não salvo — assim o termo
 * é montado pelo mesmo caminho nos dois casos e nunca diverge.
 */
export interface BaseTermoEmprestimo {
  codigoAtivo: string
  funcionario: string
  matricula?: string
  setor: string
  dataEmprestimo: string
  previsaoDevolucao: string
}

/**
 * Remonta os dados do termo direto do empréstimo já registrado.
 * É o caminho usado para reimprimir um termo sem precisar de guarda extra.
 */
export function dadosTermoDeEmprestimo(
  emprestimo: BaseTermoEmprestimo,
  ativo: Ativo | undefined,
): DadosTermoEmprestimo {
  return {
    codigoAtivo: emprestimo.codigoAtivo,
    descricao: ativo?.descricao ?? '',
    tipo: ativo?.tipo ?? '',
    marca: ativo?.marca,
    modelo: ativo?.modelo,
    serial: ativo?.serial,
    tombamento: ativo?.tombamento,
    setor: emprestimo.setor,
    funcionario: emprestimo.funcionario,
    matricula: emprestimo.matricula,
    dataEmprestimo: emprestimo.dataEmprestimo,
    previsaoDevolucao: emprestimo.previsaoDevolucao,
  }
}

/**
 * Procura o termo já gerado para este empréstimo.
 * Compara o texto montado, que é determinístico e imutável — não depende de
 * id nem de vínculo explícito entre as duas tabelas.
 */
export function acharTermoDoEmprestimo(
  termos: Termo[],
  emprestimo: BaseTermoEmprestimo,
  ativo: Ativo | undefined,
): Termo | undefined {
  const conteudo = conteudoTermoEmprestimo(dadosTermoDeEmprestimo(emprestimo, ativo))
  return termos.find((t) => t.conteudo === conteudo)
}
