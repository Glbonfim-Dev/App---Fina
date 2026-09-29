# Fina — controle financeiro pessoal

Página web para organizar rendas, despesas, contas, cartões, parcelas, orçamentos e metas.

## Tecnologias

- React 18, TypeScript e Vite 8;
- Supabase Auth e PostgreSQL com Row Level Security (RLS);
- Vitest, Testing Library e Playwright;
- Capacitor 8 para Android;
- GitHub Pages para hospedagem da página estática.

## Pré-requisitos

- Node.js 24 LTS e npm 11 ou superiores;
- conta e projeto no Supabase;
- Git;
- para Android nativo: Android Studio, Android SDK 36, JDK 21 e um emulador ou aparelho com Android 7+;
- para iOS nativo: macOS, Xcode e conta Apple Developer. Em Windows/Linux, teste a página web com o perfil de iPhone do Playwright.

## Configuração local

```bash
git clone https://github.com/Glbonfim-Dev/App---Fina.git
cd App---Fina
npm ci
cp .env.example .env
```

No Windows PowerShell, use `Copy-Item .env.example .env`. Preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Nunca use a chave `service_role` no frontend. A chave `anon` é pública por definição; a segurança depende das políticas RLS.

### Banco de dados

Para um projeto novo, abra **Supabase → SQL Editor**, execute [supabase/schema.sql](supabase/schema.sql) e confirme que não houve erros.

Para uma instalação criada com uma versão anterior do Fina, execute primeiro o backup e depois, em ordem, os arquivos de [supabase/migrations](supabase/migrations/). A migração `202609280001_security_hardening.sql` adiciona o estado `cancelada`, constraints e endurece as funções `SECURITY DEFINER`.

Em **Authentication → URL Configuration**, configure:

- Site URL de desenvolvimento: `http://localhost:5173`;
- URL de produção: endereço do GitHub Pages com a barra final;
- Redirect URLs: os dois endereços acima e `com.fina.app://auth/callback` para Android.

Ative confirmação de e-mail e configure SMTP próprio antes de liberar o cadastro ao público.

## Execução

```bash
npm run dev
```

Abra `http://localhost:5173`. Para disponibilizar na rede local: `npm run dev -- --host`. Não exponha o servidor de desenvolvimento em redes não confiáveis.

## Qualidade e testes

```bash
npm run typecheck     # tipos TypeScript
npm run lint          # análise estática
npm test              # testes unitários
npm run build         # build de produção
npm run check         # todos os comandos acima
npx playwright install chromium webkit
npm run test:e2e      # smoke test Android/iOS em viewport móvel
npm audit             # dependências conhecidamente vulneráveis
```

O smoke test E2E funciona com ou sem `.env`: quando configurado, valida a tela real de login conectada ao Supabase; sem configuração, valida a tela segura de setup. Ele não cria usuários nem grava dados. O roteiro completo com conta de homologação, aparelhos físicos e emuladores está em [docs/MOBILE_TESTING.md](docs/MOBILE_TESTING.md). Os resultados da revisão atual estão em [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md).

## Android nativo

O projeto `android/` já está versionado.

```bash
npm run mobile:sync
npm run android:open
```

No Android Studio, selecione um aparelho e use **Run**. Pela linha de comando, com SDK/JDK configurados:

```bash
npm run android:run
cd android
./gradlew assembleDebug       # Windows: .\gradlew.bat assembleDebug
./gradlew bundleRelease       # Windows: .\gradlew.bat bundleRelease
```

- APK de debug: `android/app/build/outputs/apk/debug/app-debug.apk`;
- AAB de release: `android/app/build/outputs/bundle/release/app-release.aab`.

Uma release destinada à Play Store deve ser assinada com keystore mantido fora do Git. Veja o procedimento completo em [docs/MOBILE_TESTING.md](docs/MOBILE_TESTING.md).

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie esta pasta (sem o `.env`).
2. Em **Settings > Secrets and variables > Actions**, crie os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Em **Settings > Pages**, em **Source**, escolha **GitHub Actions**.
4. Faça um push na branch `main` e aguarde a aba **Actions** terminar; o endereço aparece em **Settings > Pages**.
5. No Supabase, em **Authentication > URL Configuration**, coloque o endereço do GitHub Pages (com a barra final, por exemplo: `https://usuario.github.io/fina/`) em **Site URL** e em **Redirect URLs**.

## Segurança e operação

- Não faça commit de `.env`, certificados, keystores, senhas ou chaves privadas.
- Execute `npm audit`, testes e build em toda alteração; a CI também os executa.
- Teste o isolamento RLS com duas contas distintas antes de cada release.
- Revise logs do Supabase e limites de autenticação; use SMTP próprio.
- Faça backup antes de migrations e habilite Point-in-Time Recovery quando o plano permitir.
- Os documentos em `public/termos.html` e `public/privacidade.html` ainda precisam receber a identidade e o contato legal do controlador antes da publicação.
- Consulte [SECURITY.md](SECURITY.md) para reporte e checklist de incidentes.

## Estrutura

```text
.github/                 CI e atualizações automáticas
android/                 projeto Android Capacitor
docs/                    testes mobile e evidências
e2e/                     smoke tests Playwright
public/                  favicon e documentos legais
src/components/          componentes reutilizáveis
src/lib/                 Supabase, regras e testes unitários
src/pages/               autenticação, onboarding e telas principais
supabase/schema.sql      instalação nova do banco
supabase/migrations/     atualizações de bancos existentes
```

## Limitações conhecidas

- A aplicação não integra automaticamente com bancos; todos os dados são informados pelo usuário.
- O build iOS nativo não pode ser gerado fora do macOS/Xcode.
- Termos e política de privacidade exigem preenchimento e revisão jurídica antes de produção.
