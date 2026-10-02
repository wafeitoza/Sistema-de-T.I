import { describe, expect, it } from 'vitest'
import {
  dataBRparaDate,
  diasAte,
  formatarData,
  formatarMoeda,
  formatarNumeroBR,
  hojeBR,
  paraISO,
  parseMoeda,
  saudacao,
  somarDiasBR,
} from './format'

describe('formatarMoeda', () => {
  it('retorna travessão para undefined e NaN', () => {
    expect(formatarMoeda(undefined)).toBe('—')
    expect(formatarMoeda(Number.NaN)).toBe('—')
  })

  it('formata em BRL', () => {
    expect(formatarMoeda(21440)).toBe('R$\u00A021.440,00')
    expect(formatarMoeda(0)).toBe('R$\u00A00,00')
  })
})

describe('formatarData', () => {
  it('mantém datas já em formato BR', () => {
    expect(formatarData('01/10/2026')).toBe('01/10/2026')
  })

  it('converte ISO para BR', () => {
    expect(formatarData('2026-10-01T12:00:00.000Z')).toBe('01/10/2026')
  })

  it('retorna travessão para vazio', () => {
    expect(formatarData(undefined)).toBe('—')
    expect(formatarData('')).toBe('—')
  })

  it('devolve valor bruto se inválido', () => {
    expect(formatarData('data-invalida')).toBe('data-invalida')
  })
})

describe('paraISO / dataBRparaDate', () => {
  it('converte DD/MM/AAAA para ISO no meio-dia', () => {
    expect(paraISO('01/10/2026')).toBe('2026-10-01T12:00:00')
  })

  it('devolve a entrada se não houver partes', () => {
    expect(paraISO('abc')).toBe('abc')
  })

  it('converte para Date válido', () => {
    const d = dataBRparaDate('01/10/2026')
    expect(d).toBeInstanceOf(Date)
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(9)
    expect(d?.getDate()).toBe(1)
  })

  it('retorna null para data impossível', () => {
    expect(dataBRparaDate('99/99/9999')).toBeNull()
  })
})

describe('diasAte', () => {
  it('retorna 0 para hoje', () => {
    expect(diasAte(hojeBR())).toBe(0)
  })

  it('retorna negativo para data passada', () => {
    expect(diasAte('01/01/2000')).toBeLessThan(0)
  })

  it('retorna null para data inválida', () => {
    expect(diasAte('99/99/9999')).toBeNull()
  })
})

describe('somarDiasBR', () => {
  it('soma dias mantendo o formato BR', () => {
    expect(somarDiasBR('01/10/2026', 7)).toBe('08/10/2026')
    expect(somarDiasBR('30/10/2026', 3)).toBe('02/11/2026')
  })
})

describe('saudacao', () => {
  it('cumprimenta conforme a hora', () => {
    expect(saudacao(new Date(2026, 0, 1, 9))).toBe('Bom dia')
    expect(saudacao(new Date(2026, 0, 1, 13))).toBe('Boa tarde')
    expect(saudacao(new Date(2026, 0, 1, 20))).toBe('Boa noite')
    expect(saudacao(new Date(2026, 0, 1, 4))).toBe('Boa noite')
    expect(saudacao(new Date(2026, 0, 1, 5))).toBe('Bom dia')
  })
})

describe('formatarNumeroBR / parseMoeda', () => {
  it('formata com 2 casas decimais', () => {
    expect(formatarNumeroBR(1234.5)).toBe('1.234,50')
    expect(formatarNumeroBR(undefined)).toBe('')
    expect(formatarNumeroBR(null)).toBe('')
    expect(formatarNumeroBR(Number.NaN)).toBe('')
  })

  it('parseia moeda brasileira', () => {
    expect(parseMoeda('R$ 1.234,56')).toBe(1234.56)
    expect(parseMoeda('45')).toBe(45)
    expect(parseMoeda('1.234')).toBe(1234)
    expect(parseMoeda('')).toBeUndefined()
    expect(parseMoeda('abc')).toBeUndefined()
  })
})

describe('hojeBR', () => {
  it('gera data no padrão BR', () => {
    expect(hojeBR()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })
})
