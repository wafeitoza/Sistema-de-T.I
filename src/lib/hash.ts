export async function sha256Hex(texto: string): Promise<string> {
  const dados = new TextEncoder().encode(texto)
  const buffer = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
