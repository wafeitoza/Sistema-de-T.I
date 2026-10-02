export async function redimensionarImagem(
  arquivo: File,
  maxLado = 256,
  qualidade = 0.8,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(arquivo)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Falha ao carregar imagem'))
    el.src = dataUrl
  })

  const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
  const largura = Math.max(1, Math.round(img.width * escala))
  const altura = Math.max(1, Math.round(img.height * escala))

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(img, 0, 0, largura, altura)
  return canvas.toDataURL('image/jpeg', qualidade)
}

export async function cortarImagem(
  dataUrl: string,
  area: { x: number; y: number; width: number; height: number },
  qualidade = 0.8,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Falha ao carregar imagem'))
    el.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 256, 256)
  ctx.drawImage(
    img,
    area.x,
    area.y,
    Math.max(1, area.width),
    Math.max(1, area.height),
    0,
    0,
    256,
    256,
  )

  return canvas.toDataURL('image/jpeg', qualidade)
}
