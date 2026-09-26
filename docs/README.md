# Project Documentation

Short, plain-language guides for Stashly. Read in this order:

| #   | Doc                                                | What it answers                                               |
| --- | -------------------------------------------------- | ------------------------------------------------------------- |
| 1   | [Product Requirements (PRD)](./01-PRD.md)          | What are we building, for whom, and what must be true?        |
| 2   | [Architecture](./02-Architecture.md)               | How do the app, database, and backend fit together?           |
| 3   | [API Contract](./03-API-Contract.md)               | What does the backend send and receive?                       |
| 4   | [Implementation Plan](./04-Implementation-Plan.md) | What do we build, in what order, and how do we know it works? |

## What this app does (one line)

Save links and Instagram reels you like, keep them in your own private library, and browse them in a pretty board — offline, on your phone.

## Two ways to save a bookmark

1. **Paste a link** — no backend needed. The app fetches the title and image itself.
2. **Send the reel to yourself on Instagram** — our backend reads your DMs and pulls the new links for you (this is the "paid/connected" tier).

Both ways write the **same kind of row** into the same table. That one rule is what makes dedup and the UI work.

## Related docs (already in the repo)

- `plans/freemiumVersio.md` — the detailed two-tier build guide (the "why" behind the contract).
- `DesingDecision/decisions.md` — design decision records (ADR style, newest on top).
- `backend/README.md` (lives outside this repo) — how to run the Instagram DM service.

## Keeping docs honest

- When a decision changes, add a short entry in `DesingDecision/decisions.md`.
- Update these docs when the API contract, schema, or save flows change.
