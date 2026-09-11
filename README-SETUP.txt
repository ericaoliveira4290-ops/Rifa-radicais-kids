RIFA RADICAIS KIDS — VERSÃO ROBUSTA

IMPORTANTE:
1. Esta versão NÃO depende das funções get_rifa_numeros/get_rifa_snapshot para funcionar.
2. O site lê e grava as reservas diretamente nas tabelas Supabase usando a chave secreta do servidor.
3. NÃO é necessário executar o supabase.sql novamente para corrigir o problema atual.
4. No Render, mantenha as variáveis já existentes: SUPABASE_URL e uma chave server-side (SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_KEY).
5. Pix exibido: 62996251975. Pix usado internamente no BR Code: +5562996251975.

Após o deploy, teste:
/api/health
Deve retornar JSON com ok:true e count:1 enquanto o teste 'teste' do número 01 existir.

NÃO APAGUE O REGISTRO DE TESTE antes de confirmar o deploy.
