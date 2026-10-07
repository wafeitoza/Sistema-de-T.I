-- =============================================================================
-- Fase D — Aprovação por link (RN004) sem segredo no bundle
--
-- O "HMAC" client-side (FNV-1a de 32 bits com segredo hardcoded) é substituído
-- por `solicitacoes.aprovacao_token` — UUID aleatório gerado no ato do envio e
-- guardado só no banco. Possuir o UUID é a capacidade de decidir: por isso as
-- duas funções abaixo são as ÚNICAS coisas que o papel `anon` pode executar e
-- elas devolvem/examina apenas a linha daquele token.
--
-- A página /aprovacao/:token roda fora do Layout (sem login), então não pode
-- depender de leitura de tabela — daí as RPCs security definer.
-- =============================================================================

-- Devolve a solicitação do token, ou null (token inexistente/expirado).
-- A validação de assinatura é trivial: o UUID vem do banco e tem 122 bits de
-- aleatoriedade — não é forjável nem enumerável.
create or replace function public.solicitacao_por_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(s)
  from public.solicitacoes s
  where s.aprovacao_token = p_token
    and s.token_expira_em is not null
    and s.token_expira_em > now();
$$;

revoke all on function public.solicitacao_por_token(uuid) from public;
grant execute on function public.solicitacao_por_token(uuid) to anon, authenticated, service_role;

-- Decide a solicitação do token. Escreve a linha + o registro de auditoria
-- (o anon não tem INSERT em auditoria) numa única transação.
-- Retorna { ok, erro?, status?, id? }.
create or replace function public.decidir_por_token(
  p_token uuid,
  p_acao text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.solicitacoes%rowtype;
  v_novo_status text;
begin
  if p_acao not in ('aprovar', 'rejeitar') then
    return jsonb_build_object('ok', false, 'erro', 'Ação inválida');
  end if;

  select * into v
  from public.solicitacoes
  where aprovacao_token = p_token
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Token inválido');
  end if;

  if v.token_expira_em is null or v.token_expira_em < now() then
    return jsonb_build_object('ok', false, 'erro', 'Link expirado (validade de 7 dias)');
  end if;

  if v.status <> 'Enviada' then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Esta solicitação já foi decidida',
      'status', v.status
    );
  end if;

  if p_acao = 'aprovar' then
    v_novo_status := 'Aprovada';
  else
    if p_motivo is null or btrim(p_motivo) = '' then
      return jsonb_build_object('ok', false, 'erro', 'Informe o motivo da rejeição');
    end if;
    v_novo_status := 'Rejeitada';
  end if;

  update public.solicitacoes
     set status = v_novo_status,
         data_aprovacao = current_date,
         motivo_rejeicao = case when v_novo_status = 'Rejeitada'
                                then btrim(p_motivo) end
   where id = v.id;

  insert into public.auditoria
    (id, usuario, acao, tabela, registro_id, campos, mensagem)
  values (
    'LOG-' || to_char(now(), 'YYYY') || '-' ||
      lpad(public.proxima_sequencia('LOG')::text, 6, '0'),
    coalesce(v.aprovador, 'link@aprovacao'),
    'UPDATE',
    'SOLICITACOES',
    v.id,
    jsonb_build_array(jsonb_build_object(
      'campo', 'status', 'antes', 'Enviada', 'depois', v_novo_status
    )),
    format('Decisão via link assinado (%s)', p_acao)
  );

  return jsonb_build_object('ok', true, 'id', v.id, 'status', v_novo_status);
end;
$$;

revoke all on function public.decidir_por_token(uuid, text, text) from public;
grant execute on function public.decidir_por_token(uuid, text, text) to anon, authenticated, service_role;

comment on function public.solicitacao_por_token(uuid) is
  'RN004: lê a solicitação dona do token de aprovação (link público de 7 dias)';
comment on function public.decidir_por_token(uuid, text, text) is
  'RN004: aprova/rejeita pelo token e grava a auditoria numa única transação';
