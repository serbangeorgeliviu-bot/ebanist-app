#!/usr/bin/env bash
# Netlify `ignore`: exit 0 = sare peste deploy, exit 1 = publică.
#
# Același repo publică pe două proiecte: ebanist-com (ebanist.com) și
# whimsical-wisp-61cbbf, adresa pe care o încarcă aplicația Android până la
# ROADMAP L.10. Fiecare deploy consumă credite Netlify (06.10.2026: echipa
# oprită la limita planului gratuit). Proiectul Android sare peste commit-urile
# care schimbă numai site-ul de prezentare, documentele sau testele. ebanist.com
# publică mereu. La orice dubiu (fără commit anterior, git eșuează) se publică.
[ "${SITE_NAME:-}" = "whimsical-wisp-61cbbf" ] || exit 1
[ -n "${CACHED_COMMIT_REF:-}" ] && [ -n "${COMMIT_REF:-}" ] || exit 1
changed=$(git diff --name-only "$CACHED_COMMIT_REF" "$COMMIT_REF" 2>/dev/null) || exit 1
[ -n "$changed" ] || exit 1
# căile care NU ajung în aplicația Android
SITE_ONLY='^(site/|site-src/|case/|(ro|it|fr)/|index\.html$|sitemap\.xml$|robots\.txt$|test/|docs/|[^/]+\.md$)'
if printf '%s\n' "$changed" | grep -Ev "$SITE_ONLY" | grep -q .; then
  echo "ignore-build: se schimbă și aplicația → publică"; exit 1
fi
echo "ignore-build: numai site/documente/teste → sare peste ${SITE_NAME}"; exit 0
