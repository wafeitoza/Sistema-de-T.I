import { describe, expect, it } from 'vitest'
import {
  gerarTokenAprovacao,
  montarLinkAprovacao,
  validarTokenAprovacao,
} from './token'

const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('gerarTokenAprovacao', () => {
  it('gera um UUID v4 por emissão (nunca repetido)', () => {
    const a = gerarTokenAprovacao()
    const b = gerarTokenAprovacao()

    expect(a.token).toMatch(RE_UUID)
    expect(a.token).not.toBe(b.token)
  })

  it('não embute dados do solicitante/aprovador (só o UUID)', () => {
    const { token } = gerarTokenAprovacao()

    expect(token).toMatch(RE_UUID)
    expect(token).not.toContain('@')
    expect(token).not.toContain('|')
  })

  it('expira em 7 dias', () => {
    const { expiraEm } = gerarTokenAprovacao()
    const validade = new Date(expiraEm).getTime() - Date.now()

    expect(validade).toBeGreaterThan(6 * 86_400_000)
    expect(validade).toBeLessThanOrEqual(7 * 86_400_000)
  })
})

describe('validarTokenAprovacao', () => {
  it('aceita um token recém-gerado', () => {
    expect(validarTokenAprovacao(gerarTokenAprovacao().token)).toEqual({
      valido: true,
    })
  })

  it('rejeita URL truncada, texto livre e vazio', () => {
    for (const invalido of ['', 'abc', 'aprovacao/123', '{}', '../../etc/passwd']) {
      const r = validarTokenAprovacao(invalido)
      expect(r.valido).toBe(false)
      expect(r.motivo).toBeTruthy()
    }
  })

  it('não aceita hex fora do formato UUID', () => {
    expect(validarTokenAprovacao('a'.repeat(32)).valido).toBe(false)
    expect(
      validarTokenAprovacao('00000000-0000-0000-0000-000000000000').valido,
    ).toBe(true)
  })
})

describe('montarLinkAprovacao', () => {
  it('monta a URL absoluta da rota pública', () => {
    const token = gerarTokenAprovacao().token
    expect(montarLinkAprovacao(token)).toBe(
      `${window.location.origin}/aprovacao/${token}`,
    )
  })
})
