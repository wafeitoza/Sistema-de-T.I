import { beforeEach, describe, expect, it } from 'vitest'
import { aplicarBackup, COLECOES_BACKUP, gerarBackup, validarBackup } from './backup'

describe('gerarBackup', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('monta backup v1 com todas as coleções e sequências', () => {
    const backup = gerarBackup()
    expect(backup.versao).toBe(1)
    expect(backup.geradoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    for (const nome of COLECOES_BACKUP) {
      expect(Array.isArray(backup.colecoes[nome])).toBe(true)
    }
    expect(backup.sequencias).toBeDefined()
  })

  it('lê dados persistidos no localStorage', () => {
    localStorage.setItem('ITSTOCK_USUARIOS', JSON.stringify([{ id: 'USR-1' }]))
    const backup = gerarBackup()
    expect(backup.colecoes.USUARIOS).toEqual([{ id: 'USR-1' }])
  })

  it('leva também as sequências de ativo e de item de estoque', () => {
    // se o backup não levar, um restore re-emite NOTE-001/Item-001 para um
    // código que já existe — e no Supabase o upsert por PK sobrescreve a linha
    localStorage.setItem('ITSTOCK_SEQ_ATV_NOTE', '12')
    localStorage.setItem('ITSTOCK_SEQ_ITEM', '34')
    const backup = gerarBackup()
    expect(backup.sequencias?.ATV_NOTE).toBe(12)
    expect(backup.sequencias?.ITEM).toBe(34)
  })
})

describe('aplicarBackup', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('nunca regride a sequência mesmo num backup antigo (só 11 sequências)', () => {
    localStorage.setItem('ITSTOCK_SEQ_ATV_NOTE', '12')
    const antigo = gerarBackup()
    delete antigo.sequencias.ATV_NOTE

    aplicarBackup(antigo)
    expect(localStorage.getItem('ITSTOCK_SEQ_ATV_NOTE')).toBe('12')
  })
})

describe('validarBackup', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('aceita um backup gerado pelo sistema', () => {
    const resultado = validarBackup(JSON.stringify(gerarBackup()))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.resumo.some((r) => r.nome === 'USUARIOS')).toBe(true)
    }
  })

  it('rejeita registro sem a chave primária da coleção', () => {
    const backup = gerarBackup()
    backup.colecoes.ATIVOS = [{ nome: 'Sem código' }]
    const resultado = validarBackup(JSON.stringify(backup))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('codigo')
  })

  it('rejeita registro que não é objeto', () => {
    const backup = gerarBackup()
    backup.colecoes.SOLICITACOES = ['não sou uma linha']
    const resultado = validarBackup(JSON.stringify(backup))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('SOLICITACOES')
  })

  it('rejeita JSON inválido', () => {
    const resultado = validarBackup('isso não é json {')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('JSON')
  })

  it('rejeita estrutura não reconhecida', () => {
    expect(validarBackup(JSON.stringify(null)).ok).toBe(false)
    expect(validarBackup(JSON.stringify('texto')).ok).toBe(false)
  })

  it('rejeita versão desconhecida', () => {
    const resultado = validarBackup(JSON.stringify({ versao: 2, colecoes: {} }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('Versão')
  })

  it('rejeita backup sem coleções', () => {
    const resultado = validarBackup(JSON.stringify({ versao: 1 }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('coleções')
  })

  it('rejeita backup sem coleção essencial', () => {
    const resultado = validarBackup(JSON.stringify({ versao: 1, colecoes: { SETORES: [] } }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('essencial')
  })

  it('rejeita coleção que não é lista', () => {
    const colecoes: Record<string, unknown> = {}
    for (const nome of COLECOES_BACKUP) colecoes[nome] = []
    colecoes.SOLICITACOES = { nao: 'lista' }
    const resultado = validarBackup(JSON.stringify({ versao: 1, colecoes }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('SOLICITACOES')
  })
})
