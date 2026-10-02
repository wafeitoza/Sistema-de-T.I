import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Botao } from './Botao'
import { cortarImagem } from '../../lib/image'

interface AjusteFotoProps {
  imagem: string
  aoConfirmar: (cortada: string) => void
  aoCancelar: () => void
}

export function AjusteFoto({ imagem, aoConfirmar, aoCancelar }: AjusteFotoProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)

  const aoCompletar = useCallback((_: Area, pixels: Area) => {
    setAreaPixels(pixels)
  }, [])

  async function aplicar() {
    if (!areaPixels || areaPixels.width < 1 || areaPixels.height < 1) return
    const cortada = await cortarImagem(imagem, areaPixels)
    aoConfirmar(cortada)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-72 overflow-hidden rounded-lg bg-surface-2">
        <Cropper
          image={imagem}
          crop={crop}
          zoom={zoom}
          rotation={0}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={aoCompletar}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-xs text-content-muted">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 cursor-pointer"
          aria-label="Zoom da foto"
        />
        <span className="w-10 text-right text-xs text-content-muted">
          {zoom.toFixed(1)}×
        </span>
      </div>

      <p className="text-[11px] text-content-muted">
        Arraste para enquadrar · use a roda do mouse ou os dedos para dar zoom ·
        a prévia final é quadrada (256px).
      </p>

      <div className="flex justify-end gap-2">
        <Botao variante="secundario" tamanho="sm" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao tamanho="sm" onClick={aplicar}>
          Usar foto
        </Botao>
      </div>
    </div>
  )
}
