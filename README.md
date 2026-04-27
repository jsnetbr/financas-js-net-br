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
- Lancamentos com categoria e data.
- Categorias por usuario.
- Recorrencias mensais simples.
- Regras RLS para cada usuario ver apenas os proprios dados.

## Confirmacao no Supabase

Depois de criar uma conta e salvar um lancamento, rode:

```sql
select count(*) from public.transactions;
select count(*) from public.categories;
select count(*) from public.recurring_transactions;
```
