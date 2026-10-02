import { describe, expect, it } from 'vitest'
import { errosAtivo, obrigatorio, validarData, validarEmail } from './validation'

describe('validarEmail', () => {
  it('aceita e-mails válidos', () => {
    expect(validarEmail('admin@empresa.com')).toBe(true)
    expect(validarEmail('  user.name+tag@dominio.co.br  ')).toBe(true)
  })

  it('rejeita e-mails inválidos', () => {
    expect(validarEmail('')).toBe(false)
    expect(validarEmail('sem-arroba')).toBe(false)
    expect(validarEmail('a@b')).toBe(false)
    expect(validarEmail('@empresa.com')).toBe(false)
    expect(validarEmail('a b@empresa.com')).toBe(false)
  })
})

describe('validarData', () => {
  it('aceita datas reais', () => {
    expect(validarData('01/10/2026')).toBe(true)
    expect(validarData('29/02/2024')).toBe(true)
    expect(validarData('31/12/2026')).toBe(true)
  })

  it('rejeita datas impossíveis', () => {
    expect(validarData('31/02/2026')).toBe(false)
    expect(validarData('29/02/2026')).toBe(false)
    expect(validarData('32/01/2026')).toBe(false)
    expect(validarData('01/13/2026')).toBe(false)
    expect(validarData('00/01/2026')).toBe(false)
  })

  it('rejeita formato errado', () => {
    expect(validarData('2026-10-01')).toBe(false)
    expect(validarData('1/10/2026')).toBe(false)
    expect(validarData('')).toBe(false)
  })
})

describe('obrigatorio', () => {
  it('exige conteúdo não vazio', () => {
    expect(obrigatorio('abc')).toBe(true)
    expect(obrigatorio('  abc  ')).toBe(true)
    expect(obrigatorio('')).toBe(false)
    expect(obrigatorio('   ')).toBe(false)
    expect(obrigatorio(undefined)).toBe(false)
  })
})

describe('errosAtivo', () => {
  const camposValidos = {
    descricao: 'Notebook Dell',
    tipo: 'Notebook',
    setor: 'TI',
    responsavel: 'tecnico@empresa.com',
    dataAquisicao: '01/10/2026',
  }

  it('retorna vazio quando tudo é válido', () => {
    expect(errosAtivo(camposValidos)).toEqual({})
  })

  it('aponta todos os campos obrigatórios', () => {
    const erros = errosAtivo({
      descricao: '',
      tipo: '',
      setor: '',
      responsavel: '',
      dataAquisicao: '',
    })
    expect(Object.keys(erros).sort()).toEqual([
      'dataAquisicao',
      'descricao',
      'responsavel',
      'setor',
      'tipo',
    ])
  })

  it('valida e-mail e data individualmente', () => {
    const erros = errosAtivo({ ...camposValidos, responsavel: 'invalido', dataAquisicao: '31/02/2026' })
    expect(erros.responsavel).toBe('E-mail inválido')
    expect(erros.dataAquisicao).toBe('Use o formato DD/MM/AAAA')
    expect(erros.descricao).toBeUndefined()
  })
})
