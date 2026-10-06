import { describe, expect, it } from 'vitest'
import { modoSupabase } from './client'

describe('modoSupabase', () => {
  it('fica desligado nos testes mesmo com .env.local presente', () => {
    // O vitest carrega o .env.local; sem esta trava os testes sincronizariam
    // com o banco de produção. Ver também src/data/client.ts.
    expect(import.meta.env.MODE).toBe('test')
    expect(modoSupabase).toBe(false)
  })
})
