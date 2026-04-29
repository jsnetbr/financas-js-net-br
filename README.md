# Financas pessoais

App pessoal de controle financeiro com React, Vite, TypeScript e Supabase.

## Banco usado pelo projeto

Este app usa somente este projeto Supabase:

- Projeto: `uaffbuylvighmgibzqhn`
- URL: `https://uaffbuylvighmgibzqhn.supabase.co`

Hoje nao existe outro backend no repo. O "backend" do app e o proprio Supabase com:

- Auth por email e senha
- tabelas em `public`
- RLS para separar os dados por usuario

No front, a unica biblioteca de banco/autenticacao usada e `@supabase/supabase-js`.

## Estrutura importante

- `src/lib/supabase.ts`: conexao do front com o Supabase
- `supabase-schema.sql`: SQL idempotente para alinhar o banco real
- `supabase/migrations/`: migracoes locais do Supabase CLI
- `supabase/config.toml`: configuracao local do projeto Supabase

## Configuracao rapida

1. Copie `.env.example` para `.env`
2. Preencha:

```env
VITE_SUPABASE_URL=https://uaffbuylvighmgibzqhn.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_public
```

3. Instale e rode:

```bash
npm install
npm run dev
```

## Como alinhar o banco real

Se o projeto Supabase ja existe e voce quer deixar tudo certo:

1. Abra o **SQL Editor** no Supabase
2. Rode o arquivo `supabase-schema.sql`
3. Se houver categorias repetidas com o mesmo nome no mesmo grupo, renomeie ou apague antes de aplicar a regra nova de categoria unica

Esse SQL ja inclui:

- `transactions.is_paid`
- `transactions.source_recurring_id`
- `transactions.source_month`
- `profiles.display_name`
- indice unico para evitar duplicacao de recorrencia no mesmo mes
- regra para impedir categoria duplicada por usuario e tipo

## Supabase CLI no repo

Este repo ja foi preparado para usar o Supabase CLI localmente.

Quando for conectar sua maquina ao projeto real, use:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref uaffbuylvighmgibzqhn
```

Importante:

- sem `supabase login` ou `SUPABASE_ACCESS_TOKEN`, o comando `link` nao termina
- as migracoes oficiais ficam em `supabase/migrations/`
- o arquivo `supabase/config.toml` ja esta ajustado para o projeto e para o app local em `http://127.0.0.1:3003`

## Scripts

```bash
npm run dev
npm run build
npm run test
npm run preview
```

## O que o app ja faz

- login por email e senha
- recuperacao de senha
- resumo mensal
- lancamentos com criar, editar e apagar
- marcar saida como paga ou pendente
- categorias por entrada e saida
- recorrencias com bloqueio de duplicacao no mesmo mes
- limites por categoria
- relatorios do mes
- configuracoes de conta
- PWA instalavel

## Cloudflare Pages

Configure estas variaveis no deploy:

```env
VITE_SUPABASE_URL=https://uaffbuylvighmgibzqhn.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_public
```

Depois rode:

```bash
npm run build
```

Observacoes:

- o projeto nao usa `_redirects`, para evitar o erro de loop no Cloudflare
- o service worker guarda apenas o casco do app e assets estaticos
- dados do Supabase nao ficam em cache offline

## Checklist simples de entrega

1. Rodar `supabase-schema.sql` no Supabase
2. Rodar `npm run test`
3. Rodar `npm run build`
4. Fazer deploy no Cloudflare
5. Testar login, lancamentos, pago/pendente, recorrencia, troca de mes e recuperacao de senha
