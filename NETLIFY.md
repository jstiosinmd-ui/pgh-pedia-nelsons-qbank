# Netlify delivery

---

Netlify builds the web edition with `node scripts/build-netlify.cjs` and publishes `.tmp/netlify-site`. Large embedded banks are served in small files, with a loading indicator, integrity checks, and retries. Practice loads only the selected bank. The application runtime, questions, difficulty labels, and progress format are unchanged from v2.3.

The original self-contained HTML files and offline ZIPs remain unchanged. Use those ZIPs for offline study. The generated web edition requires a connection while loading its question bank.

Files under `_studio` use content hashes and immutable caching. Changed question data therefore receives new URLs. The build verifies that the pieces reconstruct the original JSON exactly. The generated `web-delivery-manifest.json` records source and hosted-page hashes.

Large runtime scripts also arrive in small pieces and are verified before execution. The hosted exam and board-review policies authorize their exact SHA-256 hashes and permit the loader and data requests from the same origin. Third-party script and data origins remain blocked. The offline policy remains unchanged.

Run `node scripts/build-netlify.cjs`, then `node tests/hosted.cjs`. The browser checks cover both practice sources, saved progress, scoring, exam generation, board review, download retries, and rejection of corrupted or incomplete question data. Set `PLAYWRIGHT_MODULE` and `BROWSER_PATH` if Playwright and Chromium are installed outside the default locations.
