# Plan: Extract typography tokens into the theme

Status: **applied** — tokens live on `AppTheme.typography`; primary Home/Pin surfaces use them.

## Goal

The theme (`constants/theme.ts` → `AppTheme`) currently carries only colors.
Font sizes and line heights are hardcoded as Tailwind arbitrary values
(`text-[Npx]`, `leading-[Npx]`, `leading-4`) across 8 components.

Approach (confirmed with user):
- Inline style from `AppTheme` (typed typography object referenced via
  `style={{ fontSize: ... }}`).
- Extract **typography only** (font sizes + line heights), not spacing/radius/colors.

## 1. `constants/theme.ts` — add a typed `typography` scale

- Add `AppTypography` type and extend `AppTheme` with `typography`.
- Define one shared `typography` const (identical for dark/light — type scales
  don't change per theme) and spread it into both `MyDarkTheme` and
  `MyLightTheme`.
- Exact tokens, derived from current usage (UI stays pixel-identical):

```
fontSize:    micro 9 · caption 10 · small 11 · card 12 · body 13 · title 14 · heading 15 · featured 24
lineHeight:  tight 14 · snug 15 · compact 16 · normal 17 · loose 19
```

## 2. Convert hardcoded sizes → `theme.typography`

Convert every `text-[Npx]` / `leading-[Npx]` / `leading-4` to inline
`style={{ fontSize: t.fontSize.X, lineHeight: t.lineHeight.Y }}`, keeping the
existing weight/color/tracking classes. Where a file already has
`const c = theme.colors`, add `const t = theme.typography`.

| File | Sizes → tokens |
|---|---|
| `Home/HomeScreen.tsx` | 24→featured; 11→small (x2); 12→card |
| `Home/PinCard.tsx` | 12→card + 16→compact; 10→caption (x2); 9→micro |
| `Home/PinTypePill.tsx` | 9→micro |
| `Home/SearchBar.tsx` | 14→title |
| `Home/FilterPopover.tsx` | 14→title; 11→small; 10→caption; 12→card |
| `Pin/PinActionMenu.tsx` | 13→body |
| `Pin/PinDetailPopover.tsx` | 11→small; 9→micro; 15→heading+19→loose; 12→card+16→compact; 10→caption (x3); 11→small+15→snug (notes); 13→body |
| `Pin/AddBookmarkPopover.tsx` | 14→title; 11→small (x4); 13→body (x5); 10→caption (x2); 13→body+17→normal; 11→small+15→snug |
| `Profile/ProfilePopover.tsx` | 11→small (x3); 10→caption (x3); 12→card (x2); 13→body (x3); 14→title; 10→caption+14→tight |

Non-typography arbitrary values (e.g. `h-[180px]` image heights) stay untouched.

## 3. Verify & commit

- `tsc --noEmit` + `npm run lint` (then `npx prettier --write` if flagged).
- Commit: `refactor: centralize typography tokens in theme`.

## Note

No decision-doc entry needed (pure structural refactor, no behavior change).