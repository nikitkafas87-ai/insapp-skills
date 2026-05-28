# Разбор GitHub-Репозиториев

Дата проверки: 2026-05-28.

Проверялся аккаунт `nikitkafas87-ai`. На момент проверки найдено 15 owner-репозиториев, все публичные.

## Оставить

| Репозиторий | Причина |
|---|---|
| `insapp-skills` | Центральный архив Codex-скиллов, MCP, конфигов и HTML-отчетов. |
| `reports-index` | Публичный индекс отчетов: `https://nikitkafas87-ai.github.io/reports-index/`. Удаление сломает текущую точку входа. |
| `badges-osago` | Активный C# autotests-репозиторий: локальные рабочие копии `C:\Users\nikit\projects\autotests` и `C:\Users\nikit\projects\autotests-badges-main` смотрят на него как на `origin`. Есть ветка `codex/osago-autotests`. |

## Можно Архивировать

Эти репозитории выглядят как одноразовые HTML-отчеты. Они маленькие, Pages работают, и большинство ссылок используется в `reports-index`. Архивация GitHub-репозитория безопаснее удаления: история и Pages остаются доступными, но репозиторий становится read-only.

| Репозиторий | Статус |
|---|---|
| `ab-black-friday-errors-2026-04-24` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |
| `ins1657-kasko-from-osago-report` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |
| `ins1657-kasko-review` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |
| `ins1688-kasko-apikey-report` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |
| `ins3149-kasko-autofill` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |
| `ins3180-pari-logo` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |
| `kasko-drive-analytics-march` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |
| `kasko-drive-disabled` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |
| `kasko-regression-report` | Отчет есть в `reports-index` и заархивирован в `insapp-skills/reports/standalone/`. |

## Можно Удалить После Подтверждения

Эти репозитории не входят в `reports-index`, их Pages URL на проверке не отвечали, а HTML уже заархивирован в `insapp-skills`.

| Репозиторий | Что сохранено перед удалением |
|---|---|
| `base64-bug-report` | `insapp-skills/reports/standalone/base64-bug-report/index.html`, commit источника `788a244`. |
| `base64-decode-bug-report` | `insapp-skills/reports/standalone/base64-decode-bug-report/index.html`, commit источника `929aa76`. |

## Старый Дубль Автотестов

| Репозиторий | Почему не удалять сразу |
|---|---|
| `autotests` | Сравнение показало, что `autotests/main` является предком `badges-osago/main` и `badges-osago/codex/osago-autotests`; уникальных коммитов в `autotests` нет. Удаление через GitHub API было заблокировано правами credential (`403 Must have admin rights to Repository`), поэтому репозиторий заархивирован и помечен как старый дубль. |

## Если Нужен Минимум Репозиториев

1. Оставить `insapp-skills`, `reports-index`, `badges-osago`.
2. Перенести standalone Pages-отчеты из 9 отдельных репозиториев в подпапки `reports-index/<slug>/`.
3. Обновить ссылки в `reports-index/index.html`.
4. Проверить каждую публичную ссылку после Pages build.
5. После этого удалить 9 standalone report repos.
6. `autotests` уже проверен и заархивирован как старый дубль; удалить вручную, если нужен полный cleanup и есть admin/delete_repo-доступ.
7. Удалить `base64-bug-report` и `base64-decode-bug-report`, если пользователь подтвердит удаление.

Без миграции ссылок лучше не удалять standalone report repos, потому что это сломает публичные URL из `reports-index`.
