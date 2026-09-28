# Evidências e resultados dos testes

Execução de referência: 28/09/2026. Ambiente: Windows, Node.js 24.18.0. Os resultados abaixo devem ser atualizados a cada release.

| Verificação | Comando | Resultado |
|---|---|---|
| Auditoria de dependências | `npm audit --audit-level=low` | Aprovado — 0 vulnerabilidades |
| Tipos | `npm run typecheck` | Aprovado |
| Lint | `npm run lint` | Aprovado — 0 erros/avisos |
| Unitários | `npm test` | Aprovado — 2 arquivos, 8 testes |
| Build web | `npm run build` | Aprovado — 79 módulos; JS principal 105,42 kB gzip |
| Android Pixel 7 | `npm run test:e2e` | Aprovado — Chromium, 584 ms |
| iPhone 13 simulado | `npm run test:e2e` | Aprovado — WebKit, 865 ms |
| Sincronização Capacitor | `npm run mobile:sync` | Aprovado — projeto Android e plugin `@capacitor/app` sincronizados |
| APK Android | `gradlew assembleDebug` | Não executável neste ambiente sem JDK/Android SDK |

## Escopo da evidência automatizada

- testes unitários das regras de dinheiro, calendário, recorrências canceladas e CSV;
- smoke test em dois perfis móveis, incluindo console, responsividade e manifesto PWA;
- compilação de produção e sincronização dos ativos no projeto Android;
- auditoria pública de vulnerabilidades das dependências.

Screenshots, vídeos e traces são produzidos automaticamente apenas em falhas e ficam em `test-results/`/`playwright-report/` ou como artefato da GitHub Actions.

## Ocorrências da execução

- A primeira tentativa do perfil iPhone não iniciou porque o WebKit ainda não estava instalado. A configuração e a CI foram atualizadas para instalar Chromium e WebKit; a repetição passou nos dois perfis.
- A geração de APK/AAB não foi simulada: `java`, `adb`, `ANDROID_HOME` e `ANDROID_SDK_ROOT` não estão disponíveis nesta máquina. O projeto Android foi gerado e sincronizado, mas a compilação nativa deve ser executada em uma estação com os pré-requisitos documentados.
