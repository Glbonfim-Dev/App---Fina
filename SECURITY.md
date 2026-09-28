# Política de segurança

## Versões suportadas

Somente a versão presente na branch `main` recebe correções de segurança.

## Reporte responsável

Não abra issue pública contendo tokens, dados pessoais ou detalhes exploráveis. Use **Security → Report a vulnerability** no GitHub do projeto. Inclua impacto, passos mínimos de reprodução e versão afetada, usando apenas dados fictícios.

## Segredos

- Somente `VITE_SUPABASE_URL` e a chave pública `anon` podem chegar ao frontend.
- `service_role`, senha do banco, keystore e credenciais de publicação nunca devem ser versionadas.
- Se um segredo vazar, revogue-o imediatamente, remova-o do histórico e revise logs.

## Controles existentes

- RLS em todas as tabelas com dados de usuário;
- funções `SECURITY DEFINER` com `search_path` vazio e privilégio mínimo;
- validações no banco e no cliente;
- CSP e cabeçalhos defensivos na Vercel;
- dependências fixadas em lockfile, Dependabot e auditoria na CI;
- cancelamento lógico de ocorrências recorrentes para preservar unicidade e histórico.

## Checklist antes de produção

1. Executar `npm audit`, `npm run check` e `npm run test:e2e`.
2. Testar RLS com duas contas e requisições diretas à API.
3. Ativar confirmação de e-mail, SMTP próprio, MFA dos administradores e proteção da conta GitHub/Vercel/Supabase.
4. Preencher e revisar juridicamente termos e privacidade.
5. Habilitar backups e testar restauração.
6. Confirmar que source maps, `.env`, keystores e relatórios com dados pessoais não foram publicados.
