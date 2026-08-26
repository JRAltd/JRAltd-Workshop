# cfm Markup / Margin Calculator

A pocket-calculator-styled tool for CFM Distributor's Inc. to quickly convert between **cost**, **markup %**, **margin %**, and **sale price**.

## What it does

- Punch in a cost and either a markup % or margin % using the on-screen keypad (or your keyboard).
- Toggle **BY MARKUP %** / **BY MARGIN %** depending on which one you're working from.
- The screen shows the resulting sale price, profit $, and the equivalent value of the other percentage (markup and margin are not the same number for the same deal).

## Formulas

- Markup: `Price = Cost × (1 + Markup% ÷ 100)`
- Margin: `Price = Cost ÷ (1 − Margin% ÷ 100)`

## Files

- `index.html` — the full calculator, no build step or dependencies. Just open it in a browser.

## Live version

Served via GitHub Pages at the repo's Pages URL, path `projects/cfm-markup-calculator/`.
