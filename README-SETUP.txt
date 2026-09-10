RIFA RADICAIS KIDS — BANCO PERMANENTE

1) Crie um projeto no Supabase.
2) Abra SQL Editor > New query.
3) Cole todo o conteúdo de supabase.sql e clique em Run.
4) No Supabase, copie o Project URL e crie/obtenha uma Secret API Key (Settings > API Keys). A Secret Key é somente para o servidor; nunca coloque no HTML.
5) No Render > Environment, adicione:
   SUPABASE_URL = URL do projeto Supabase
   SUPABASE_SECRET_KEY = Secret API Key do Supabase
   ADMIN_PASSWORD = sua senha da área /admin
   EMAIL_USER = Oliveira.ericamenezes@gmail.com
   EMAIL_PASS = sua senha de aplicativo do Gmail
   EMAIL_TO = Oliveira.ericamenezes@gmail.com
6) Faça deploy desta versão no Render.
7) A área do organizador fica em /admin.

IMPORTANTE: esta versão não usa rifa.json para as reservas. Os números ficam no banco Postgres do Supabase e não devem voltar a ficar disponíveis quando o Render reiniciar.

A reserva é registrada quando a pessoa clica em “Reservar números e gerar Pix”. O sistema não confirma o pagamento bancário; ele registra a reserva e gera o Pix.


FONTE: O site usa Montserrat em todos os elementos (títulos, textos, números, botões, campos e área do organizador).

IMPORTANTE NO GITHUB: envie os arquivos da raiz deste pacote. Não envie/recupere rifa.json, pois as reservas agora ficam no Supabase.
