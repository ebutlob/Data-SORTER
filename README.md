# Data Sorter

Paste pipe-delimited records → get structured, copyable cards.

## Local run

    npm install
    npm start
    # open http://localhost:3000

## Format

    0  card      | 1  month | 2  year | 3  cvv
    4  name      | 5  address | 6 city | 7 state
    8  zip       | 9  country | 10 phone | 11 email
    12+ tail: status token (LIVE/DEAD/…), reason, source

Trailing columns are variable-width — the parser collapses blank
segments and locates the status token by name, so both
`|| ||LIVE|…` and `||LIVE|…` resolve identically.

Change core column order in `lib/parser.js` → `COLUMNS`.
