# PGH Pediatrics Exam Maker

---

Download the [offline package](20261006_PGH_NelsonsExamMaker_v1.1.zip), extract it, and open the HTML in a compatible browser. Alternatively, download this repository and open [index.html](index.html). GitHub's HTML source view does not run the app. The offline package contains the exam maker and its guide. It has no standalone question-bank page or link to one.

The self-contained examiner tool lets you choose the question count, sections or specific topics, difficulty, and exam details. It generates a question-paper PDF with a blank answer sheet and a matching answer-key PDF. The credit `/jstiosin 2026` appears in the HTML footer and on every generated PDF page.

## Generate PDFs

1. Set the exam title, number of questions, duration, date, and difficulty. Choose Easy, Average, Difficult, Mixed, or a custom percentage mix.
2. Select sections or specific topics. The count must allow at least one question for every selected group.
3. Choose whether the key should include rationales and references. Traditional single-best-answer questions are selected by default; the optional legacy Type K setting retains the 40% cap.
4. Tap **Generate exam**. Review five questions at a time with Previous and Next.
5. On mobile, tap **Prepare exam PDF** or **Prepare answer key PDF**, then tap the corresponding **Save or open** link. If the browser opens a PDF preview, use its Save or Share control. Desktop downloads start directly.

The question-paper PDF includes a blank answer sheet. The answer-key PDF contains the matching answer grid and, when selected, explanations and references. Changing settings clears the old draw and its PDF links. Download PDFs and the optional exam record before closing the tab.

## Examiner use

Keep the HTML file and answer key with examiners. Distribute the generated question-paper PDF to examinees. The HTML still embeds the full question pool and answers so it can generate exams offline; removing the standalone study page does not make those embedded data private.

Questions, logos, scripts, PDF libraries, and fonts are contained in the file. No account, server, or internet connection is required when the browser supports local HTML apps. A file previewer that cannot run JavaScript cannot operate the tool.

## Question coverage

The unchanged source pool contains 6,700 Nelson Textbook of Pediatrics, 21st-edition questions across 33 sections, including the corrected September 29, 2026 Respiratory System content. Section 34, Laboratory Medicine, is not included. Difficulty labels are editorial estimates. This interface revision does not perform a fresh clinical source review.

## Design

The saved UP-PGH Heritage palette supplies Maroon `#7B1113`, Forest Green `#014421`, Heritage Cream `#FDFAF3`, Warm Cream `#F0E7D2`, and small Gold `#FFB81C` accents. This is the workspace's established maroon-and-cream design system. The Philippine General Hospital (PGH) logo was retrieved from the [official PGH website](https://www.pgh.gov.ph/about-pgh/) on October 6, 2026. The HTML file embeds the original downloaded PNG, with no redrawing or recoloring. PDFs use A4 pages and embedded Calibri fonts. These saved palettes are operational design systems; the package does not claim that they are published official hospital brand manuals.

## Verification

The v1.1 application and offline ZIP are byte-identical to the tested local release. Each edition passed 62 checks covering mobile layouts, topic and difficulty selection, exam previews, offline PDF downloads, and the absence of standalone study navigation. The credit `/jstiosin 2026` and institutional header were checked on every page of the generated paper and key PDFs.

Chrome desktop and touch emulation were used at widths of 320, 360, 390, 430, 768, 932, and 1440 pixels. Physical phones and Safari were not tested. These checks validate software behavior; they do not constitute a fresh clinical source review.

## Run the existing mobile checks

With Node.js, Playwright, and Chromium installed, run:

```sh
node tests/mobile.cjs
```

Optionally set `BROWSER_PATH` to an installed Chrome executable and `PLAYWRIGHT_MODULE` to an existing Playwright module. Results, screenshots, and test PDFs are written into the ignored `.tmp/exam-only-qa/` folder. Test tooling is not required to use the app.

## Files

- [index.html](index.html): self-contained exam maker.
- [20261006_PGH_NelsonsExamMaker_v1.1.zip](20261006_PGH_NelsonsExamMaker_v1.1.zip): offline exam maker and guide.
- [tests/mobile.cjs](tests/mobile.cjs): the existing 62-check browser suite.

PDF generation embeds pdf-lib and fontkit; their attribution is included inside the HTML. This repository grants no additional rights to third-party references, fonts, libraries, or institutional marks.
