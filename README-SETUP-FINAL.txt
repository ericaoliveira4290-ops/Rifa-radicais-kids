RIFA RADICAIS KIDS — CORREÇÃO DEFINITIVA DOS NÚMEROS RESERVADOS

O Pix NÃO foi alterado.

IMPORTANTE: esta versão usa duas funções do Supabase para a leitura do status. Isso evita que o RLS faça o site enxergar 0 números mesmo quando existem reservas.

FAÇA UMA ÚNICA VEZ NO SUPABASE:
1. Abra o projeto rifa-radicais-kids.
2. SQL Editor > New query.
3. Abra o arquivo supabase.sql deste pacote.
4. Copie TODO o conteúdo e execute (Run).
5. O resultado deve ser "Success".

DEPOIS:
- Substitua os arquivos do GitHub pelos arquivos deste pacote.
- Aguarde o Render concluir o deploy.
- Não apague a reserva teste do número 01.

RESULTADO ESPERADO:
01 bloqueado
99 disponíveis
1 reservado
1%

Se o Supabase não estiver com as funções criadas, esta versão NÃO vai fingir que existem 0 reservas: ela mostrará erro de configuração. Isso evita perder o status silenciosamente.
