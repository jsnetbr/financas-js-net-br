# Controle financeiro pessoal

Aplicativo web para controle de financas pessoais, com login, lancamentos, recorrencias, limites por categoria, relatorios e instalacao como PWA.

## Recursos

- Login por email e senha
- Recuperacao de senha
- Resumo mensal de entradas, saidas e saldo
- Lancamentos com criacao, edicao e exclusao
- Status de saida como paga ou pendente
- Categorias separadas por entrada e saida
- Recorrencias mensais
- Limites por categoria
- Relatorios do mes
- Configuracoes de conta
- PWA instalavel no celular

## Tecnologias

- React
- Vite
- TypeScript
- Supabase

## Configuracao local

Crie um arquivo `.env` com as variaveis do seu ambiente:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_publica_anon
```

Depois instale e rode o app:

```bash
npm install
npm run dev
```

## Banco de dados

O arquivo `supabase-schema.sql` contem a estrutura esperada do banco.

Antes de publicar ou testar em producao:

1. Abra o editor SQL do Supabase.
2. Rode o conteudo de `supabase-schema.sql`.
3. Confirme que as politicas de seguranca estao ativas.
4. Teste login, lancamentos, recorrencias, limites e relatorios.

As migracoes ficam em `supabase/migrations/` para manutencao futura.

## Scripts

```bash
npm run dev
npm run build
npm run test
npm run preview
```

## Deploy

Configure as variaveis de ambiente na plataforma de hospedagem:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_publica_anon
```

Depois publique a pasta gerada pelo build:

```bash
npm run build
```

## PWA

O app inclui manifest, icones e service worker para instalacao no celular.

Depois do deploy, teste:

- abrir o app no navegador;
- instalar no celular;
- fechar e abrir novamente;
- confirmar que login e dados carregam normalmente;
- confirmar que a logo e o nome do app aparecem corretamente.

## Checklist de entrega

1. Aplicar o SQL do banco.
2. Configurar variaveis de ambiente.
3. Rodar testes.
4. Rodar build.
5. Publicar.
6. Testar login e recuperacao de senha.
7. Testar lancamentos, pago/pendente e recorrencias.
8. Testar limites, relatorios e troca de mes.
9. Testar instalacao PWA no celular.
