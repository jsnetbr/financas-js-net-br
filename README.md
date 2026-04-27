# Financas pessoais

App simples de controle financeiro pessoal com Vite, React, TypeScript e Supabase.

## Como configurar

1. Crie ou abra o projeto no Supabase.
2. No Supabase, entre em **SQL Editor** e rode o arquivo `supabase-schema.sql`.
3. Copie `.env.example` para `.env`.
4. Preencha:

```env
VITE_SUPABASE_URL=https://uaffbuylvighmgibzqhn.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_public
```

5. Rode:

```bash
npm install
npm run dev
```

## O que ja existe

- Login por email e senha.
- Resumo mensal de entradas, saidas e saldo.
- Lancamentos com categoria, data, edicao e exclusao com confirmacao.
- Marcacao de saidas como pago ou pendente.
- Categorias por usuario, separadas por entrada/saida, com edicao de nome/cor.
- Recorrencias mensais com edicao, pausa, exclusao e bloqueio de duplicacao por mes.
- Configuracoes de conta para nome exibido, email e senha.
- PWA instalavel no celular com manifest, icones e service worker basico.
- Regras RLS para cada usuario ver apenas os proprios dados.

## Cloudflare Pages

Configure as variaveis em **Settings > Environment variables**:

```env
VITE_SUPABASE_URL=https://uaffbuylvighmgibzqhn.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_public
```

Use:

```bash
npm run build
```

Depois do deploy, confira se `https://financas.js.net.br/manifest.webmanifest` abre e se o navegador oferece a instalacao do app.

## PWA

O service worker guarda apenas o casco do app para melhorar a instalacao e abertura. Ele nao guarda dados do Supabase offline.

## Atualizacao do banco

Se o projeto ja tinha o SQL antigo, rode novamente o arquivo `supabase-schema.sql` no **SQL Editor**. Ele e seguro para repetir e adiciona o controle que evita gerar a mesma recorrencia duas vezes no mesmo mes, o status de pagamento e o nome exibido do perfil.

## Confirmacao no Supabase

Depois de criar uma conta e salvar um lancamento, rode:

```sql
select count(*) from public.transactions;
select count(*) from public.categories;
select count(*) from public.recurring_transactions;
```
