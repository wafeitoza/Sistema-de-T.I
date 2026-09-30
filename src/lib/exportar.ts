function escaparCelula(valor: string | number): string {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`
}

export function exportarCSV(
  arquivo: string,
  colunas: string[],
  linhas: (string | number)[][],
  info?: string[],
): void {
  const linhasCSV = [
    ...(info ?? []),
    ...(info?.length ? [''] : []),
    colunas.map(escaparCelula).join(';'),
    ...linhas.map((l) => l.map(escaparCelula).join(';')),
  ]
  // BOM para o Excel reconhecer UTF-8; separador ";" no padrão pt-BR.
  const conteudo = '\uFEFF' + linhasCSV.join('\r\n')
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = arquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
