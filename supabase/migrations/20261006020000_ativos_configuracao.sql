-- Campo de configuração do equipamento (CPU/RAM/Armazenamento, resolução, etc.).
-- Opcional: ativos já existentes ficam com NULL e a etiqueta omite a linha.
alter table public.ativos
  add column if not exists configuracao text;

comment on column public.ativos.configuracao is
  'Especificação técnica livre exibida na etiqueta e no QR do equipamento';
