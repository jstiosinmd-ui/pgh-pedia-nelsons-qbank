# PGH Pediatrics Exam Studio release

---

Version 2.3 adds **Practice questions** with a choice of Nelson's question bank (6,700 questions in 33 sections) or board exam sets (1,000 questions in ten sets). Both sources now use the same CMC practice workflow: timed attempts, saved answers, flags, scoring, explanations, review filters, and progress backup/import.

Open [the studio](index.html), [practice questions](question-bank.html), or download the [complete offline package](20261013_PGH_PediatricsExamStudio_v2.3.zip) and extract it before opening index.html. See the [guide](README.md) for progress transfer and timer behavior.

Question wording, keys, explanations, sources, and difficulty labels are unchanged from v2.2. Existing CMC and St. Paul's Nelson backups remain compatible. The earlier individual board-question browser remains available with its own progress. Exam generation and PDF logic are unchanged.

The four-edition release passed 380 browser checks and 102 content, structure, and package checks. The [manifest](release-manifest.json) records exact file hashes and check counts. Old dated ZIPs and earlier Git history remain available.

For software regression checks, run `node tests/practice.cjs` with Playwright installed. `PLAYWRIGHT_MODULE` and `BROWSER_PATH` can select local installations; `QA_DIR` sets the evidence folder. Set `FULL_SCORE_TEST=1` to exercise every answer in a complete board set. An optional `LEGACY_STUDY_PATH` tests an existing CMC or St. Paul's Nelson backup against this edition.

Created by Jon Bryan S. Tiosin, MD. (c) jstiosin 2026.
