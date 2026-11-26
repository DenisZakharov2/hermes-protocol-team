# Source Allow-list Policy

## Purpose

Политика управления `schemas/common/source-allowlist.json` — единственным источником разрешённых доменов для `research_output.sources[].url`.

## Criteria for Inclusion

- Официальные сайты регуляторов РФ: ЦБ (cbr.ru), Минфин (minfin.gov.ru), ГОСТ (gost.ru), Официальный интернет-портал правовой информации (pravo.gov.ru), суды (vsrf.ru, asrf.ru, ksrf.ru), Росстат (rosstat.gov.ru)
- Международные стандарты: BIS (bis.org), Basel Committee, IASB (ifrs.org), ISO (iso.org)
- Авторитетные финансовые издания (с редакционной политикой): РБК, Коммерсантъ, ВЭдомости, ТАСС, Интерфакс — только официальные поддомены
- Запрещено: файлообменники, сокращатели ссылок, user-generated content, блоги, форумы, соцсети

## Process

1. Issue/PR с обоснованием домена
2. Security review (maintainer + legal-compliance-counsel skill)
3. Approve → merge → CI validate (прогоняет validate-json с новым доменом)
4. Deploy

## Technical Notes

- Allow-list хранит ASCII домены (punycode для IDN)
- Проверка в валидаторе: `host === allowed || host.endsWith('.' + allowed)` после `new URL()` parsing
- Subdomain matching: `api.cbr.ru` проходит если `cbr.ru` в списке
- Non-ASCII в allow-list запрещены (нормализуйте в punycode перед добавлением)
