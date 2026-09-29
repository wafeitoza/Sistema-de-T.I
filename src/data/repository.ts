const PREFIXO = 'ITSTOCK_'

export function lerColecao<T>(colecao: string): T[] {
  try {
    const raw = localStorage.getItem(`${PREFIXO}${colecao}`)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export function gravarColecao<T>(colecao: string, dados: T[]): void {
  localStorage.setItem(`${PREFIXO}${colecao}`, JSON.stringify(dados))
}

export function lerItem<T>(colecao: string, chave: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIXO}${colecao}_${chave}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function gravarItem<T>(colecao: string, chave: string, valor: T): void {
  localStorage.setItem(`${PREFIXO}${colecao}_${chave}`, JSON.stringify(valor))
}

export function proximaSequencia(nome: string): number {
  const chave = `${PREFIXO}SEQ_${nome}`
  const atual = Number.parseInt(localStorage.getItem(chave) ?? '0', 10) || 0
  const proximo = atual + 1
  localStorage.setItem(chave, String(proximo))
  return proximo
}

export function colecaoExiste(colecao: string): boolean {
  return localStorage.getItem(`${PREFIXO}${colecao}`) !== null
}

export function limparTudo(): void {
  const chaves: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i)
    if (chave?.startsWith(PREFIXO)) chaves.push(chave)
  }
  chaves.forEach((c) => localStorage.removeItem(c))
}
