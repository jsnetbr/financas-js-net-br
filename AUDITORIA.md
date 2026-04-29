# Auditoria do projeto Financas

Data: 2026-04-29

## Resumo

O app esta em bom caminho para uso pessoal: usa Supabase com RLS, guarda valores em centavos, evita `toISOString()` nas regras mensais e tem `.env` fora do Git. Nao encontrei achado critico de vazamento de chave secreta ou regra financeira quebrada durante a auditoria local.

O principal bloqueio de producao neste ambiente e o `spawn EPERM` ao rodar o build completo com Vite/Cloudflare. A checagem TypeScript passa e os testes unitarios passam depois do ajuste no script de teste.

## Achados por prioridade

### Alto

1. Build completo bloqueado por `spawn EPERM`

- Impacto: impede confirmar o pacote final localmente neste Windows, mesmo com o TypeScript passando.
- Area: `npm run build`, Vite, esbuild, Cloudflare/Wrangler.
- Evidencia: `npm run build` falha ao carregar `vite.config.ts` com `Error: spawn EPERM`.
- Recomendacao: tratar como bloqueio de ambiente/permissao do Windows. Validar em outro ambiente, no Cloudflare Pages ou em um terminal sem essa restricao. Nao parece ser erro de regra do app.

2. Test runner original tambem era afetado por `spawn EPERM`

- Impacto: `npm run test` falhava antes de executar os testes, gerando falso negativo.
- Area: `package.json`.
- Correcao aplicada: o script passou a executar o arquivo de teste compilado diretamente com `node`, evitando o modo `node --test` que tenta criar processo filho neste ambiente.

### Medio

3. Componente principal esta grande

- Impacto: futuras mudancas em abas, tabelas e modais ficam mais arriscadas porque muita regra esta concentrada em um arquivo.
- Area: `src/components/FinanceDashboard.tsx`.
- Recomendacao: separar gradualmente tabelas de recorrencias, categorias e limites em componentes menores, sem mudar comportamento.

4. Ordenacao de tabelas esta duplicada

- Impacto: cada tabela tem sua propria logica de ordenacao; isso aumenta chance de inconsistencia visual ou bug ao ajustar uma delas.
- Area: `FinanceDashboard.tsx` e `TransactionCards.tsx`.
- Recomendacao: criar um helper/componente simples para cabecalho ordenavel quando a tela estabilizar.

5. Validacao visual ainda depende do navegador

- Impacto: mudancas recentes de tabela precisam de conferencia manual em desktop e celular.
- Area: abas Lancamentos, Recorrencias, Categorias e Limites.
- Recomendacao: manter checagem manual no browser local e, depois, considerar teste visual leve para telas principais.

### Baixo

6. Politicas de seguranca HTTP podem evoluir

- Impacto: `_headers` ja tem protecoes basicas, mas ainda nao define CSP.
- Area: `public/_headers`.
- Recomendacao: adicionar CSP somente apos testar login, Supabase e PWA, para nao quebrar carregamento por configuracao rigida demais.

7. Auditoria remota do Supabase nao foi executada nesta passada

- Impacto: a auditoria local confirma migrations e RLS nos arquivos, mas nao prova que o banco remoto esta exatamente igual.
- Area: projeto Supabase `uaffbuylvighmgibzqhn`.
- Recomendacao: rodar advisors/checagem no Supabase real antes de considerar a producao fechada.

## Correcoes aplicadas

- Corrigido `npm run test` para funcionar neste Windows.
- Confirmado que `.env` esta ignorado pelo Git.
- Confirmado que nao ha chave `service_role` no codigo do frontend.
- Confirmado que a chave configurada e anon/publica, adequada para frontend.

## Validacao local

- `npm.cmd exec tsc -- -b`: passou.
- `npm.cmd run test`: passou apos ajuste do script.
- `npm run build`: ainda falha com `spawn EPERM`.
- `.env`: ignorado por `.gitignore`.

## Proximas correcoes recomendadas

1. Validar build em ambiente sem bloqueio `spawn EPERM` ou no Cloudflare.
2. Rodar auditoria/advisors no Supabase remoto.
3. Separar `FinanceDashboard.tsx` em componentes menores quando a UI parar de mudar tanto.
