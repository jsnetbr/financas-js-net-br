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
- Resumo mensal de entradas, saidas, saldo e previsto.
- Lancamentos com categoria, data, edicao e exclusao com confirmacao.
- Categorias por usuario, separadas por entrada/saida, com edicao de nome/cor.
- Recorrencias mensais com edicao, pausa, exclusao e bloqueio de duplicacao por mes.
- PWA basico para instalar no celular.
- Regras RLS para cada usuario ver apenas os proprios dados.

## Atualizacao do banco

Se o projeto ja tinha o SQL antigo, rode novamente o arquivo `supabase-schema.sql` no **SQL Editor**. Ele e seguro para repetir e adiciona o controle que evita gerar a mesma recorrencia duas vezes no mesmo mes.

## Confirmacao no Supabase

Depois de criar uma conta e salvar um lancamento, rode:

```sql
select count(*) from public.transactions;
select count(*) from public.categories;
select count(*) from public.recurring_transactions;
```
