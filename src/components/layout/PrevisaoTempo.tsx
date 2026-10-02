import { useEffect, useState } from 'react'
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

type Coordenadas = {
  lat: number
  lon: number
  nome: string
}

type Dados = {
  temp: number
  max: number
  min: number
  codigo: number
  dia: boolean
  local: string
}

const LOCAL_PADRAO: Coordenadas = {
  lat: -23.5505,
  lon: -46.6333,
  nome: 'São Paulo, SP',
}

const LOCAIS_POR_FUSO: Record<string, Coordenadas> = {
  'America/Sao_Paulo': LOCAL_PADRAO,
  'America/Bahia': { lat: -12.9718, lon: -38.5011, nome: 'Salvador, BA' },
  'America/Belem': { lat: -1.4558, lon: -48.5039, nome: 'Belém, PA' },
  'America/Fortaleza': { lat: -3.7319, lon: -38.5267, nome: 'Fortaleza, CE' },
  'America/Recife': { lat: -8.0476, lon: -34.877, nome: 'Recife, PE' },
  'America/Noronha': { lat: -3.8549, lon: -32.4233, nome: 'Fernando de Noronha, PE' },
  'America/Manaus': { lat: -3.119, lon: -60.0217, nome: 'Manaus, AM' },
  'America/Campo_Grande': { lat: -20.4697, lon: -54.6201, nome: 'Campo Grande, MS' },
  'America/Cuiaba': { lat: -15.6014, lon: -56.0979, nome: 'Cuiabá, MT' },
  'America/Boa_Vista': { lat: 2.8238, lon: -60.6753, nome: 'Boa Vista, RR' },
  'America/Porto_Velho': { lat: -8.7608, lon: -63.8999, nome: 'Porto Velho, RO' },
  'America/Rio_Branco': { lat: -9.9747, lon: -67.8243, nome: 'Rio Branco, AC' },
}

const TEXTOS: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Predominantemente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Nevoeiro',
  48: 'Nevoeiro com geada',
  51: 'Garoa fraca',
  53: 'Garoa moderada',
  55: 'Garoa forte',
  56: 'Garoa congelante fraca',
  57: 'Garoa congelante forte',
  61: 'Chuva fraca',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  66: 'Chuva congelante fraca',
  67: 'Chuva congelante forte',
  71: 'Neve fraca',
  73: 'Neve moderada',
  75: 'Neve forte',
  77: 'Grãos de neve',
  80: 'Pancadas isoladas',
  81: 'Pancadas de chuva',
  82: 'Pancadas fortes',
  85: 'Pancadas de neve',
  86: 'Pancadas fortes de neve',
  95: 'Trovoadas',
  96: 'Trovoadas com granizo',
  99: 'Trovoadas fortes com granizo',
}

function localPorFuso(): Coordenadas {
  try {
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone
    return LOCAIS_POR_FUSO[fuso] ?? LOCAL_PADRAO
  } catch {
    return LOCAL_PADRAO
  }
}

function icone(codigo: number, dia: boolean): LucideIcon {
  if (codigo === 0) return dia ? Sun : Moon
  if (codigo === 1) return dia ? Sun : CloudMoon
  if (codigo === 2) return dia ? CloudSun : CloudMoon
  if (codigo === 3) return Cloud
  if (codigo === 45 || codigo === 48) return CloudFog
  if (codigo >= 71 && codigo <= 77) return CloudSnow
  if (codigo === 85 || codigo === 86) return CloudSnow
  if (codigo >= 95) return CloudLightning
  if (codigo >= 51) return CloudRain
  return CloudSun
}

function corPorCodigo(codigo: number): string {
  if (codigo >= 95) return 'text-primary'
  if (codigo >= 71) return 'text-info'
  if (codigo >= 51) return 'text-info'
  if (codigo === 45 || codigo === 48) return 'text-content-muted'
  return 'text-warning'
}

async function buscarNomeLocal(lat: number, lon: number, fallback: string) {
  try {
    const resp = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`,
    )
    if (!resp.ok) return fallback
    const j = (await resp.json()) as {
      city?: string
      locality?: string
      principalSubdivisionCode?: string
    }
    const cidade = j.city || j.locality
    const uf = j.principalSubdivisionCode?.split('-')[1]
    if (cidade && uf) return `${cidade}, ${uf}`
    return cidade || fallback
  } catch {
    return fallback
  }
}

function iconePrevisao(erro: boolean, dados: Dados | null) {
  const Componente = erro
    ? CloudOff
    : dados
      ? icone(dados.codigo, dados.dia)
      : CloudSun
  return (
    <Componente
      size={19}
      className={cn(
        'transition-colors duration-300',
        erro ? 'text-content-muted' : corPorCodigo(dados?.codigo ?? 2),
      )}
    />
  )
}

export function PrevisaoTempo() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [dados, setDados] = useState<Dados | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true

    async function carregar(coords: Coordenadas) {
      if (!vivo) return
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
          '&current=temperature_2m,weather_code,is_day' +
          '&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1'
        const resp = await fetch(url)
        if (!resp.ok) throw new Error('falha na previsão')
        const j = (await resp.json()) as {
          current: { temperature_2m: number; weather_code: number; is_day: number }
          daily: { temperature_2m_max: number[]; temperature_2m_min: number[] }
        }
        const local = await buscarNomeLocal(coords.lat, coords.lon, coords.nome)
        if (!vivo) return
        setDados({
          temp: Math.round(j.current.temperature_2m),
          max: Math.round(j.daily.temperature_2m_max[0]),
          min: Math.round(j.daily.temperature_2m_min[0]),
          codigo: j.current.weather_code,
          dia: j.current.is_day === 1,
          local,
        })
        setErro(false)
        setCarregando(false)
      } catch {
        if (!vivo) return
        setErro(true)
        setCarregando(false)
      }
    }

    function iniciar() {
      if (!navigator.geolocation) {
        void carregar(localPorFuso())
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          void carregar({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            nome: '',
          }),
        () => void carregar(localPorFuso()),
        { timeout: 7000, maximumAge: 600000 },
      )
    }

    iniciar()
    const intervalo = setInterval(iniciar, 15 * 60 * 1000)

    return () => {
      vivo = false
      clearInterval(intervalo)
    }
  }, [recarga])

  const texto = dados ? (TEXTOS[dados.codigo] ?? 'Condição do céu') : ''
  const titulo = erro
    ? 'Previsão do tempo indisponível — clique para tentar de novo'
    : dados
      ? `${texto} · Máx ${dados.max}° / Mín ${dados.min}° · ${dados.local}`
      : 'Carregando previsão do tempo…'

  return (
    <button
      type="button"
      title={titulo}
      aria-label={`Previsão do tempo: ${titulo}`}
      onClick={() => {
        setRecarga((n) => n + 1)
        setCarregando(true)
      }}
      className={cn(
        'shine hidden items-center gap-2 rounded-xl border bg-surface/70 px-3 py-1.5 backdrop-blur transition-all duration-200 sm:flex',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:scale-95',
        erro ? 'border-line opacity-70' : 'border-line',
      )}
    >
      {carregando ? (
        <Loader2 size={19} className="animate-spin text-content-muted" />
      ) : (
        iconePrevisao(erro, dados)
      )}
      <div className="flex flex-col items-start leading-none">
        <span className="num text-sm font-extrabold text-content">
          {erro || !dados ? '—°' : `${dados.temp}°`}
        </span>
        <span className="mt-1 max-w-28 truncate text-[10px] font-medium text-content-muted">
          {erro ? 'Sem previsão' : dados?.local ?? '…'}
        </span>
      </div>
    </button>
  )
}
