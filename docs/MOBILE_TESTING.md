# Testes, instalação e distribuição mobile

## 1. Pré-requisitos

### Comuns

- Node.js 24 LTS, npm 11 e Git;
- projeto Supabase de homologação, separado da produção;
- `.env` preenchido com a URL e a chave `anon` de homologação;
- duas contas de teste para validar isolamento de dados;
- conexão HTTPS para testar a instalação PWA.

### Android

- Windows, macOS ou Linux;
- Android Studio com Android SDK 36, Platform Tools e Build Tools;
- JDK 21 (`JAVA_HOME` configurado);
- emulador Android 7/API 24 ou superior, ou aparelho com depuração USB.

Confirme com `java -version`, `adb version` e `adb devices`.

### iOS

- macOS, Xcode atual, CocoaPods e Apple Developer;
- iPhone físico ou simulador;
- para gerar o projeto iOS: instale `@capacitor/ios`, execute `npx cap add ios` e configure `com.fina.app` no Signing & Capabilities.

## 2. Preparação

```bash
npm ci
cp .env.example .env
npx playwright install chromium webkit
npm run check
npm run mobile:sync
```

No Supabase, execute o schema/migrations e permita os redirects da aplicação. Use dados fictícios, nunca cópia de produção.

## 3. Teste automatizado mobile

```bash
npm run test:e2e
```

O Playwright executa Chromium em perfis Pixel 7 e iPhone 13. Em falhas, são gravados screenshot, vídeo e trace em `test-results/`; o relatório HTML fica em `playwright-report/`.

Este smoke test cobre carregamento, ausência de overflow horizontal, console, título e manifesto. Fluxos autenticados devem seguir o roteiro manual porque dependem do Supabase de homologação e de confirmação por e-mail.

## 4. Android emulador

1. Android Studio → Device Manager → Create Device → Pixel 7.
2. Selecione uma imagem API 35/36 e inicie o emulador.
3. Execute `npm run android:run` ou abra com `npm run android:open` e clique em Run.
4. Valide cadastro, link de confirmação, login, onboarding, transações, recorrências, orçamento, exportação CSV, tema, logout e exclusão de conta.
5. Alterne entre Wi-Fi, modo offline e conexão lenta; confirme mensagens de erro e recuperação.

## 5. Android físico

1. Ative Opções do desenvolvedor e Depuração USB.
2. Conecte por USB e aceite a chave RSA.
3. Confirme o serial em `adb devices`.
4. Execute `npm run android:run` e escolha o aparelho.
5. Para instalar um APK já gerado: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

## 6. iPhone/simulador

1. Em um Mac, execute `npx cap add ios` uma única vez e `npm run mobile:sync` a cada alteração web.
2. Execute `npx cap open ios`.
3. No Xcode, selecione Team, Bundle Identifier e dispositivo.
4. Execute no simulador ou em iPhone confiável.
5. Configure o URL Scheme `com.fina.app` e valide confirmação/recuperação de senha.

Para testar apenas a PWA no iPhone, publique em HTTPS, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**.

## 7. Matriz mínima de regressão

| Fluxo | Android | iOS/PWA | Resultado esperado |
|---|---:|---:|---|
| Cadastro e confirmação | ✓ | ✓ | Perfil e categorias criados uma vez |
| Login/logout/recuperação | ✓ | ✓ | Sessão segura e redirecionamento correto |
| Onboarding interrompido | ✓ | ✓ | Retoma no passo salvo |
| Receita/despesa manual | ✓ | ✓ | Totais e conta selecionada atualizados |
| Recorrência cancelada | ✓ | ✓ | Ocorrência não reaparece após recarregar |
| Orçamento | ✓ | ✓ | Considera somente despesas pagas |
| Tema e acessibilidade | ✓ | ✓ | Contraste, zoom e navegação funcionais |
| Offline/retorno da rede | ✓ | ✓ | Interface abre; dados sincronizam ao voltar |
| Exportação e exclusão | ✓ | ✓ | CSV válido; conta e dados removidos |

## 8. APK/AAB e distribuição

### Debug interno

```bash
npm run mobile:sync
cd android
.\gradlew.bat assembleDebug   # Windows
./gradlew assembleDebug       # macOS/Linux
```

Distribua o APK de debug somente para homologação por canal restrito. O aparelho precisa permitir instalação da origem utilizada.

### Release Play Store

1. Crie uma keystore fora do repositório e mantenha backup seguro.
2. Configure assinatura por variáveis/arquivo local não versionado.
3. Aumente `versionCode` e `versionName` em `android/app/build.gradle`.
4. Execute `bundleRelease`.
5. Envie o AAB ao canal Internal testing da Play Console.
6. Conclua Data Safety, política de privacidade e teste fechado antes de produção.

Nunca faça commit de `.jks`, `.keystore`, `key.properties`, senhas ou certificados.

## 9. Registro de evidências

Para cada execução, registre em `docs/TEST_RESULTS.md`: data, commit, ambiente, aparelhos, comandos, resultado, defeitos e links dos artefatos da CI. Não inclua e-mails, tokens, valores financeiros reais ou screenshots com dados pessoais.
