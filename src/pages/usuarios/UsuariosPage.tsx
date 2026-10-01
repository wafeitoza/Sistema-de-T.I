import { useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
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

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

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
    })
  }

  function fechar() {
    setAlvo(null)
    setErros({})
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
    }

    const diff = calcularDiff(
      antes as unknown as Record<string, unknown>,
      depois as unknown as Record<string, unknown>,
    )
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
      mensagem: `Perfil de ${depois.nome} atualizado`,
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
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-gradient-to-br from-primary to-info text-xs font-bold text-white shadow-md">
                      {iniciais(u.nome)}
                    </span>
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
