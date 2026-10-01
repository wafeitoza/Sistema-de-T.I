import { useMemo, useState, type ChangeEvent } from 'react'
import { Camera, Pencil, Plus, Search } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, BadgeStatus } from '../../components/ui/Badge'
import { Botao } from '../../components/ui/Botao'
import { TituloSecao } from '../../components/ui/Card'
import { Entrada, Selecao } from '../../components/ui/Campos'
import { EstadoVazio } from '../../components/ui/EstadoVazio'
import { Modal } from '../../components/ui/Modal'
import { Resumo } from '../../components/ui/Resumo'
import { CabecalhoTabela, Celula, Linha, Tabela } from '../../components/ui/Tabela'
import { gravarColecao, lerColecao } from '../../data/repository'
import { calcularDiff, registrarLog } from '../../lib/audit'
import { redimensionarImagem } from '../../lib/image'
import { TODOS_PERFIS } from '../../lib/permissions'
import { validarEmail } from '../../lib/validation'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import type { Perfil, Usuario } from '../../types'

const TOM_PERFIL: Record<Perfil, 'primary' | 'info' | 'success' | 'neutral'> = {
  Admin: 'primary',
  Gerente: 'info',
  Técnico: 'success',
  Visualizador: 'neutral',
}

const STATUS_USUARIO = ['Ativo', 'Inativo'] as const

type AlvoModal = 'criar' | Usuario | null

export function UsuariosPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const atualizarSessao = useAuthStore((s) => s.atualizarSessao)
  const notificar = useUiStore((s) => s.notificar)

  const [usuarios, setUsuarios] = useState<Usuario[]>(() =>
    lerColecao<Usuario>('USUARIOS'),
  )
  const [busca, setBusca] = useState('')
  const [alvo, setAlvo] = useState<AlvoModal>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nome: '',
    email: '',
    setor: '',
    telefone: '',
    perfil: 'Visualizador' as Perfil,
    status: 'Ativo' as 'Ativo' | 'Inativo',
    foto: undefined as string | undefined,
  })

  const editando = alvo !== null && alvo !== 'criar' ? alvo : null
  const criando = alvo === 'criar'
  const proprio = !!editando && !!usuario && editando.email === usuario.email

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return usuarios
    return usuarios.filter((u) =>
      [u.nome, u.email, u.setor, u.perfil].some((c) =>
        c.toLowerCase().includes(termo),
      ),
    )
  }, [usuarios, busca])

  const ativos = usuarios.filter((u) => u.status === 'Ativo').length
  const admins = usuarios.filter((u) => u.perfil === 'Admin').length

  function abrir(u: Usuario) {
    setAlvo(u)
    setErros({})
    setForm({
      nome: u.nome,
      email: u.email,
      setor: u.setor,
      telefone: u.telefone ?? '',
      perfil: u.perfil,
      status: u.status,
      foto: u.foto,
    })
  }

  function abrirCriar() {
    setAlvo('criar')
    setErros({})
    setForm({
      nome: '',
      email: '',
      setor: '',
      telefone: '',
      perfil: 'Visualizador',
      status: 'Ativo',
      foto: undefined,
    })
  }

  function fechar() {
    setAlvo(null)
    setErros({})
  }

  function limparErroFoto() {
    setErros((e) => {
      if (!e.foto) return e
      const { foto: _foto, ...resto } = e
      return resto
    })
  }

  async function aoEscolherFoto(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
      setErros((erros) => ({ ...erros, foto: 'Selecione um arquivo de imagem' }))
      return
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      setErros((erros) => ({ ...erros, foto: 'A imagem pode ter no máximo 5 MB' }))
      return
    }
    try {
      const foto = await redimensionarImagem(arquivo, 256, 0.8)
      setForm((f) => ({ ...f, foto }))
      limparErroFoto()
    } catch {
      setErros((erros) => ({ ...erros, foto: 'Não foi possível ler a imagem' }))
    }
  }

  function salvar() {
    if (alvo === null) return
    const lista = lerColecao<Usuario>('USUARIOS')
    const novosErros: Record<string, string> = {}

    if (!form.nome.trim()) novosErros.nome = 'Nome é obrigatório'
    if (!form.setor.trim()) novosErros.setor = 'Setor é obrigatório'

    const email = form.email.trim().toLowerCase()
    if (criando) {
      if (!email) novosErros.email = 'E-mail é obrigatório'
      else if (!validarEmail(email)) novosErros.email = 'E-mail inválido'
      else if (lista.some((u) => u.email === email))
        novosErros.email = 'E-mail já cadastrado'
    }

    if (Object.keys(novosErros).length) {
      setErros(novosErros)
      return
    }

    if (alvo === 'criar') {
      const novo: Usuario = {
        email,
        nome: form.nome.trim(),
        perfil: form.perfil,
        setor: form.setor.trim(),
        status: form.status,
        telefone: form.telefone.trim() || undefined,
        foto: form.foto,
      }
      gravarColecao('USUARIOS', [...lista, novo])
      registrarLog({
        usuario: usuario?.email ?? 'desconhecido',
        acao: 'CREATE',
        tabela: 'USUARIOS',
        registroId: novo.email,
        mensagem: `Usuário ${novo.nome} criado`,
      })
      setUsuarios((atuais) => [...atuais, novo])
      notificar('sucesso', `Usuário ${novo.nome} criado com sucesso`)
      fechar()
      return
    }

    const antes = lista.find((u) => u.email === alvo.email)
    if (!antes) return

    const depois: Usuario = {
      ...antes,
      nome: form.nome.trim(),
      setor: form.setor.trim(),
      telefone: form.telefone.trim() || undefined,
      perfil: proprio ? antes.perfil : form.perfil,
      status: proprio ? antes.status : form.status,
      foto: form.foto,
    }

    const mudouFoto = antes.foto !== depois.foto
    const diff = calcularDiff(
      antes as unknown as Record<string, unknown>,
      depois as unknown as Record<string, unknown>,
    ).filter((c) => c.campo !== 'foto')
    gravarColecao(
      'USUARIOS',
      lista.map((u) => (u.email === antes.email ? depois : u)),
    )
    registrarLog({
      usuario: usuario?.email ?? 'desconhecido',
      acao: 'UPDATE',
      tabela: 'USUARIOS',
      registroId: antes.email,
      campos: diff,
      mensagem: `Perfil de ${depois.nome} atualizado${mudouFoto ? ' (foto alterada)' : ''}`,
    })
    if (proprio) atualizarSessao(depois)
    setUsuarios((atuais) =>
      atuais.map((u) => (u.email === antes.email ? depois : u)),
    )
    notificar('sucesso', `Perfil de ${depois.nome} atualizado com sucesso`)
    fechar()
  }

  return (
    <div className="space-y-5">
      <TituloSecao
        acao={
          <Botao onClick={abrirCriar}>
            <Plus size={16} /> Novo usuário
          </Botao>
        }
      >
        Usuários
      </TituloSecao>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo titulo="Usuários" valor={usuarios.length} />
        <Resumo titulo="Ativos" valor={ativos} />
        <Resumo
          titulo="Inativos"
          valor={usuarios.length - ativos}
          destaque={usuarios.length - ativos > 0}
        />
        <Resumo titulo="Administradores" valor={admins} />
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail, setor ou perfil…"
          className="w-full rounded-lg border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-content placeholder:text-content-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filtrados.length ? (
        <Tabela>
          <CabecalhoTabela
            colunas={['Usuário', 'Perfil', 'Setor', 'Telefone', 'Status', '']}
          />
          <tbody>
            {filtrados.map((u) => (
              <Linha key={u.email}>
                <Celula>
                  <div className="flex items-center gap-3">
                    <Avatar
                      nome={u.nome}
                      foto={u.foto}
                      className="h-9 w-9 rounded-lg text-xs shadow-md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-content">
                        {u.nome}
                        {u.email === usuario?.email && (
                          <span className="ml-1.5 text-xs font-normal text-content-muted">
                            (você)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-content-muted">
                        {u.email}
                      </p>
                    </div>
                  </div>
                </Celula>
                <Celula>
                  <Badge tom={TOM_PERFIL[u.perfil]}>{u.perfil}</Badge>
                </Celula>
                <Celula className="hidden md:table-cell">{u.setor}</Celula>
                <Celula className="hidden md:table-cell">
                  {u.telefone ?? '—'}
                </Celula>
                <Celula>
                  <BadgeStatus status={u.status} />
                </Celula>
                <Celula className="text-right">
                  <Botao
                    tamanho="sm"
                    variante="secundario"
                    onClick={() => abrir(u)}
                  >
                    <Pencil size={14} /> Editar
                  </Botao>
                </Celula>
              </Linha>
            ))}
          </tbody>
        </Tabela>
      ) : (
        <EstadoVazio
          titulo="Nenhum usuário encontrado"
          mensagem="Ajuste a busca para encontrar o usuário desejado."
          acao={
            <Botao onClick={abrirCriar}>
              <Plus size={16} /> Novo usuário
            </Botao>
          }
        />
      )}

      <Modal
        aberto={alvo !== null}
        aoFechar={fechar}
        titulo={
          criando
            ? 'Novo usuário'
            : `Editar perfil — ${editando?.nome ?? ''}`
        }
        rodape={
          <>
            <Botao variante="secundario" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao onClick={salvar}>{criando ? 'Criar usuário' : 'Salvar'}</Botao>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Entrada
            label="Nome *"
            value={form.nome}
            erro={erros.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Maria Silva"
            className="sm:col-span-2"
          />
          <Entrada
            label={criando ? 'E-mail *' : 'E-mail'}
            type="email"
            value={form.email}
            erro={erros.email}
            disabled={!criando}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="nome@empresa.com"
            className="sm:col-span-2"
          />
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-2 p-3 sm:col-span-2">
            <Avatar
              nome={form.nome || '?'}
              foto={form.foto}
              className="h-16 w-16 rounded-lg text-base"
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-xs font-medium text-content-muted">
                Foto de perfil
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-content transition-all hover:border-primary/40 hover:text-primary focus-within:ring-2 focus-within:ring-primary/30">
                  <Camera size={14} />
                  {form.foto ? 'Trocar foto' : 'Escolher foto'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={aoEscolherFoto}
                  />
                </label>
                {form.foto && (
                  <Botao
                    variante="secundario"
                    tamanho="sm"
                    onClick={() => setForm((f) => ({ ...f, foto: undefined }))}
                  >
                    Remover
                  </Botao>
                )}
              </div>
              <p className="text-[11px] text-content-muted">
                PNG, JPG ou WebP de até 5 MB — otimizada para 256px.
              </p>
              {erros.foto && (
                <span className="text-xs text-danger">{erros.foto}</span>
              )}
            </div>
          </div>
          <Entrada
            label="Setor *"
            value={form.setor}
            erro={erros.setor}
            onChange={(e) => setForm({ ...form, setor: e.target.value })}
            placeholder="TI"
          />
          <Entrada
            label="Telefone"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            placeholder="(11) 99999-0000"
          />
          <Selecao
            label="Perfil *"
            value={form.perfil}
            disabled={proprio}
            onChange={(e) =>
              setForm({ ...form, perfil: e.target.value as Perfil })
            }
            opcoes={TODOS_PERFIS.map((p) => ({ valor: p, rotulo: p }))}
          />
          <Selecao
            label="Status *"
            value={form.status}
            disabled={proprio}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as 'Ativo' | 'Inativo',
              })
            }
            opcoes={STATUS_USUARIO.map((s) => ({ valor: s, rotulo: s }))}
          />
          {proprio && (
            <p className="text-xs text-content-muted sm:col-span-2">
              Você não pode alterar o próprio perfil de acesso nem o status da
              sua conta.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
