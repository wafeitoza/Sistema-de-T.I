import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

const capturados = vi.hoisted(
  () => [] as Array<{ erro: unknown; contexto?: Record<string, unknown> }>,
)

vi.mock('../../data/erros', () => ({
  reportarErro: (erro: unknown, contexto?: Record<string, unknown>) => {
    capturados.push({ erro, contexto })
  },
  errosAtivos: () => capturados.length > 0,
  iniciarErros: async () => undefined,
}))

// React exige a flag para `act` fora do renderizador de testes dele.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Explode(): never {
  throw new Error('boom no render')
}

let cont: HTMLDivElement
let raiz: Root
let consoleErro: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  capturados.length = 0
  cont = document.createElement('div')
  document.body.appendChild(cont)
  raiz = createRoot(cont)
  // o React loga o erro que caiu no boundary — é esperado aqui, não é ruído
  consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  act(() => raiz.unmount())
  cont.remove()
  consoleErro.mockRestore()
})

describe('ErrorBoundary', () => {
  it('renderiza os filhos normalmente quando não há erro', async () => {
    await act(async () => {
      raiz.render(
        <ErrorBoundary>
          <p>tudo certo</p>
        </ErrorBoundary>,
      )
    })

    expect(cont.textContent).toContain('tudo certo')
    expect(cont.textContent).not.toContain('A tela encontrou um erro')
    expect(capturados).toHaveLength(0)
  })

  it('mostra o fallback em vez de tela branca e reporta o erro', async () => {
    await act(async () => {
      raiz.render(
        <ErrorBoundary>
          <Explode />
        </ErrorBoundary>,
      )
    })

    expect(cont.textContent).toContain('A tela encontrou um erro')
    expect(cont.textContent).toContain('boom no render')
    expect(cont.textContent).toContain('Recarregar')

    expect(capturados).toHaveLength(1)
    expect((capturados[0].erro as Error).message).toBe('boom no render')
  })

  it('manda junto a página onde o erro aconteceu', async () => {
    await act(async () => {
      raiz.render(
        <ErrorBoundary>
          <Explode />
        </ErrorBoundary>,
      )
    })

    expect(capturados[0].contexto).toMatchObject({
      pagina: expect.any(String),
      componentStack: expect.any(String),
    })
  })

  it('o botão Recarregar existe para o usuário sair do impasse', async () => {
    await act(async () => {
      raiz.render(
        <ErrorBoundary>
          <Explode />
        </ErrorBoundary>,
      )
    })

    const botao = [...cont.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Recarregar',
    )
    expect(botao).toBeTruthy()
  })
})
