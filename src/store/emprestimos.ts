import { create } from 'zustand'
import { gravarColecao, lerColecao, proximaSequencia } from '../data/repository'
import { calcularDiff, registrarLog } from '../lib/audit'
import { gerarId } from '../lib/codes'
import { agoraISO, dataBRparaDate, hojeBR } from '../lib/format'
import { validarData } from '../lib/validation'
import type { Ativo, Emprestimo, Perfil } from '../types'
import { useAuthStore } from './auth'
import type { Resultado } from './setores'

const COLECAO = 'EMPRESTIMOS'

function usuarioAtual(): string {
  return useAuthStore.getState().usuario?.email ?? 'sistema@empresa.com'
}

function registrarNaAuditoria(
  acao: 'CREATE' | 'UPDATE',
  id: string,
  antes: Emprestimo | null,
  depois: Emprestimo,
): void {
  registrarLog({
    usuario: usuarioAtual(),
    acao,
    tabela: 'EMPRESTIMOS',
    registroId: id,
    campos: antes
      ? calcularDiff(
          antes as unknown as Record<string, unknown>,
          depois as unknown as Record<string, unknown>,
        )
      : Object.entries(depois).map(([campo, valor]) => ({
          campo,
          antes: null,
          depois: valor,
        })),
  })
}

export interface DadosEmprestimo {
  codigoAtivo: string
  funcionario: string
  matricula: string
  setor: string
  dataEmprestimo: string
  previsaoDevolucao: string
  observacao: string
}

interface EmprestimosState {
  emprestimos: Emprestimo[]
  emprestar: (dados: DadosEmprestimo) => Resultado
  devolver: (id: string, observacao?: string) => Resultado
  cancelar: (id: string) => Resultado
}

function cancelamentoPermitido(perfil: Perfil | undefined): boolean {
  return perfil === 'Admin' || perfil === 'Gerente'
}

export const useEmprestimosStore = create<EmprestimosState>((set, get) => ({
  emprestimos: lerColecao<Emprestimo>(COLECAO),

  emprestar: (dados) => {
    const funcionario = dados.funcionario.trim()
    const setor = dados.setor.trim()
    const codigoAtivo = dados.codigoAtivo.trim()

    if (funcionario.length < 3) {
      return { ok: false, erro: 'Informe o nome do funcionário (mínimo 3 letras).' }
    }
    if (!codigoAtivo) return { ok: false, erro: 'Selecione o equipamento.' }
    if (!setor) return { ok: false, erro: 'Informe o setor do funcionário.' }
    if (!validarData(dados.dataEmprestimo)) {
      return { ok: false, erro: 'Data do empréstimo inválida (use DD/MM/AAAA).' }
    }
    if (!validarData(dados.previsaoDevolucao)) {
      return { ok: false, erro: 'Previsão de devolução inválida (use DD/MM/AAAA).' }
    }

    const emprestimo = dataBRparaDate(dados.dataEmprestimo)
    const previsao = dataBRparaDate(dados.previsaoDevolucao)
    if (emprestimo && previsao && previsao.getTime() < emprestimo.getTime()) {
      return { ok: false, erro: 'A previsão de devolução não pode ser anterior ao empréstimo.' }
    }

    const ativo = lerColecao<Ativo>('ATIVOS').find((a) => a.codigo === codigoAtivo)
    if (!ativo) return { ok: false, erro: 'Equipamento não encontrado no cadastro de ativos.' }
    if (ativo.status === 'Descartado') {
      return { ok: false, erro: 'Equipamento descartado não pode ser emprestado.' }
    }

    const emAberto = get().emprestimos.find(
      (e) => e.codigoAtivo === codigoAtivo && e.status === 'Em aberto',
    )
    if (emAberto) {
      return {
        ok: false,
        erro: `${codigoAtivo} já está emprestado para ${emAberto.funcionario} (devolução prevista para ${emAberto.previsaoDevolucao}).`,
      }
    }

    const agora = agoraISO()
    const novo: Emprestimo = {
      id: gerarId('EMP', proximaSequencia('EMP')),
      codigoAtivo,
      funcionario,
      matricula: dados.matricula.trim() || undefined,
      setor,
      dataEmprestimo: dados.dataEmprestimo,
      previsaoDevolucao: dados.previsaoDevolucao,
      observacaoEmprestimo: dados.observacao.trim() || undefined,
      status: 'Em aberto',
      registradoPor: usuarioAtual(),
      criadoEm: agora,
      atualizadoEm: agora,
    }

    const proximos = [novo, ...get().emprestimos]
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('CREATE', novo.id, null, novo)
    set({ emprestimos: proximos })
    return { ok: true }
  },

  devolver: (id, observacao) => {
    const alvo = get().emprestimos.find((e) => e.id === id)
    if (!alvo) return { ok: false, erro: 'Empréstimo não encontrado.' }
    if (alvo.status !== 'Em aberto') {
      return { ok: false, erro: 'Este empréstimo já foi finalizado.' }
    }

    const depois: Emprestimo = {
      ...alvo,
      status: 'Devolvido',
      dataDevolucao: hojeBR(),
      observacaoDevolucao: observacao?.trim() || undefined,
      devolvidoPor: usuarioAtual(),
      atualizadoEm: agoraISO(),
    }

    const proximos = get().emprestimos.map((e) => (e.id === id ? depois : e))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ emprestimos: proximos })
    return { ok: true }
  },

  cancelar: (id) => {
    if (!cancelamentoPermitido(useAuthStore.getState().usuario?.perfil)) {
      return { ok: false, erro: 'Apenas Admin e Gerente podem cancelar empréstimos.' }
    }
    const alvo = get().emprestimos.find((e) => e.id === id)
    if (!alvo) return { ok: false, erro: 'Empréstimo não encontrado.' }
    if (alvo.status !== 'Em aberto') {
      return { ok: false, erro: 'Apenas empréstimos em aberto podem ser cancelados.' }
    }

    const depois: Emprestimo = {
      ...alvo,
      status: 'Cancelado',
      canceladoPor: usuarioAtual(),
      atualizadoEm: agoraISO(),
    }

    const proximos = get().emprestimos.map((e) => (e.id === id ? depois : e))
    gravarColecao(COLECAO, proximos)
    registrarNaAuditoria('UPDATE', id, alvo, depois)
    set({ emprestimos: proximos })
    return { ok: true }
  },
}))

export function emprestimoAtrasado(e: Emprestimo): boolean {
  if (e.status !== 'Em aberto') return false
  const alvo = dataBRparaDate(e.previsaoDevolucao)
  if (!alvo) return false
  alvo.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return alvo.getTime() < hoje.getTime()
}
