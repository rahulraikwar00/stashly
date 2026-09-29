// // import { DarkTheme, DefaultTheme, type Theme } from "expo-router";

// // // Shared semantic colors — never change between themes
// // export const Semantic = {
// //   article: "#F97316", // orange
// //   video: "#8B5CF6", // violet
// //   image: "#EC4899", // pink
// //   link: "#3B82F6", // blue
// //   danger: "#EF4444", // red
// //   success: "#22C55E", // green
// //   warning: "#F59E0B", // amber
// // };

// // export const MyDarkTheme: Theme = {
// //   ...DarkTheme,
// //   colors: {
// //     ...DarkTheme.colors,
// //     primary: "#2A835F",
// //     background: "#092328",
// //     card: "#12544F",
// //     text: "#8BBB92",
// //     border: "#1A3D3A",
// //     notification: "#E57373",
// //   },
// // };

// // export const MyLightTheme: Theme = {
// //   ...DefaultTheme,
// //   colors: {
// //     ...DefaultTheme.colors,
// //     primary: "#1F6B4F",
// //     background: "#F5FAF7",
// //     card: "#E5F0E8",
// //     text: "#092328",
// //     border: "#C7DDD0",
// //     notification: "#C62828",
// //   },
// // };

// import { DarkTheme, DefaultTheme, type Theme } from "expo-router";

// // ─────────────────────────────────────────────
// // SHARED SEMANTIC COLORS (never change)
// // ─────────────────────────────────────────────
// export const Semantic = {
//   danger: "#E57373",
//   success: "#8BBB92",
//   warning: "#C9A227",
// };

// // ─────────────────────────────────────────────
// // PREMIUM DARK THEME
// // ─────────────────────────────────────────────
// export const MyDarkTheme: Theme = {
//   ...DarkTheme,
//   colors: {
//     ...DarkTheme.colors,
//     primary: "#2A835F", // CTAs only
//     background: "#092328", // deep, quiet
//     card: "#12544F", // surface depth
//     text: "#8BBB92", // premium sage
//     border: "#1A3D3A", // subtle
//     notification: "#C9A227", // gold, not red
//   },
// };

// // ─────────────────────────────────────────────
// // PREMIUM LIGHT THEME
// // ─────────────────────────────────────────────
// export const MyLightTheme: Theme = {
//   ...DefaultTheme,
//   colors: {
//     ...DefaultTheme.colors,
//     primary: "#1F6B4F",
//     background: "#F5FAF7",
//     card: "#E5F0E8",
//     text: "#092328",
//     border: "#C7DDD0",
//     notification: "#B8860B",
//   },
// };

// // ─────────────────────────────────────────────
// // EXTRA PREMIUM TOKENS (not part of nav Theme)
// // ─────────────────────────────────────────────
// export const Premium = {
//   gold: "#C9A227",
//   goldSoft: "#E8D9A0",
//   sageDeep: "#5A8A7A",
//   sageMuted: "#4A6B63",
//   surfaceDark: "#0E3B38",
//   surfaceLight: "#FFFFFF",
// };

// import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

// // ─────────────────────────────────────────────
// // Extended theme type (adds app-specific tokens)
// // ─────────────────────────────────────────────
// export type AppTheme = Theme & {
//   colors: Theme['colors'] & {
//     surface: string; // card background
//     surfaceAlt: string; // subtle raised surface
//     textMuted: string; // secondary text
//     textFaint: string; // tertiary text
//     gold: string; // premium accent
//     goldDeep: string; // premium accent (light mode)
//     article: string;
//     video: string;
//     image: string;
//     link: string;
//   };
// };

// // ─────────────────────────────────────────────
// // DARK
// // ─────────────────────────────────────────────
// export const MyDarkTheme: AppTheme = {
//   ...DarkTheme,
//   colors: {
//     ...DarkTheme.colors,
//     primary: '#2A835F',
//     background: '#092328',
//     card: '#12544F',
//     text: '#8BBB92',
//     border: '#0E3B38',
//     notification: '#C9A227',

//     // App tokens
//     surface: '#12544F',
//     surfaceAlt: '#0E3B38',
//     textMuted: '#5A8A7A',
//     textFaint: '#4A6B63',
//     gold: '#C9A227',
//     goldDeep: '#C9A227',
//     article: '#F97316',
//     video: '#8B5CF6',
//     image: '#EC4899',
//     link: '#3B82F6',
//   },
// };

// // ─────────────────────────────────────────────
// // LIGHT
// // ─────────────────────────────────────────────
// export const MyLightTheme: AppTheme = {
//   ...DefaultTheme,
//   colors: {
//     ...DefaultTheme.colors,
//     primary: '#1F6B4F',
//     background: '#F5FAF7',
//     card: '#E5F0E8',
//     text: '#092328',
//     border: '#C7DDD0',
//     notification: '#B8860B',

//     // App tokens
//     surface: '#E5F0E8',
//     surfaceAlt: '#FFFFFF',
//     textMuted: '#4A6B63',
//     textFaint: '#5A8A7A',
//     gold: '#B8860B',
//     goldDeep: '#B8860B',
//     article: '#F97316',
//     video: '#8B5CF6',
//     image: '#EC4899',
//     link: '#3B82F6',
//   },
// };

//update theme which is good
// import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

// // ─────────────────────────────────────────────
// // Extended theme type (adds app-specific tokens)
// // ─────────────────────────────────────────────
// export type AppTheme = Theme & {
//   colors: Theme['colors'] & {
//     surface: string; // card background
//     surfaceAlt: string; // subtle raised surface
//     textMuted: string; // secondary text
//     textFaint: string; // tertiary text
//     gold: string; // premium accent
//     goldDeep: string; // premium accent (light mode)
//     article: string;
//     video: string;
//     image: string;
//     link: string;
//   };
// };

// // ─────────────────────────────────────────────
// // DARK — deep forest at night, warm sage text,
// // muted amber reserved for premium moments
// // ─────────────────────────────────────────────
// export const MyDarkTheme: AppTheme = {
//   ...DarkTheme,
//   colors: {
//     ...DarkTheme.colors,
//     primary: '#2F8F6B',
//     background: '#0A1F1C',
//     card: '#123430',
//     text: '#AFCBA6', // warmer, higher-contrast sage (was cooler #8BBB92)
//     border: '#1E4A43', // now distinct from surfaceAlt
//     notification: '#C99A3C',

//     // App tokens
//     surface: '#123430',
//     surfaceAlt: '#0E2A26',
//     textMuted: '#6C9686',
//     textFaint: '#4E7267',
//     gold: '#D9AE5C', // lifted for legibility on dark surfaces
//     goldDeep: '#C99A3C', // the "resting" amber, used on lighter/accent fills
//     article: '#F2894E',
//     video: '#9B7BD9',
//     image: '#E0699A',
//     link: '#5B94E0',
//   },
// };

// // ─────────────────────────────────────────────
// // LIGHT — warm parchment rather than clinical
// // white, mirrors dark mode's identity inverted
// // ─────────────────────────────────────────────
// export const MyLightTheme: AppTheme = {
//   ...DefaultTheme,
//   colors: {
//     ...DefaultTheme.colors,
//     primary: '#1F7A57',
//     background: '#F6F3EA',
//     card: '#EAF0E4',
//     text: '#0F231F',
//     border: '#C9DAC5',
//     notification: '#A47522',

//     // App tokens
//     surface: '#EAF0E4',
//     surfaceAlt: '#FFFFFF',
//     textMuted: '#4E6B60',
//     textFaint: '#6C8A7E',
//     gold: '#A47522',
//     goldDeep: '#7A5A19', // deeper still, for fine text/small badges
//     article: '#D9713A',
//     video: '#7A5EC4',
//     image: '#C24F80',
//     link: '#3E6FBF',
//   },
// };

import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

// ─────────────────────────────────────────────
// Typography scale (identical for dark/light)
// ─────────────────────────────────────────────
export type AppTypography = {
  fontSize: {
    micro: number;
    caption: number;
    small: number;
    card: number;
    body: number;
    title: number;
    heading: number;
    featured: number;
  };
  lineHeight: {
    tight: number;
    snug: number;
    compact: number;
    normal: number;
    loose: number;
  };
};

export const typography: AppTypography = {
  fontSize: {
    micro: 9,
    caption: 10,
    small: 11,
    card: 12,
    body: 13,
    title: 14,
    heading: 15,
    featured: 24,
  },
  lineHeight: {
    tight: 14,
    snug: 15,
    compact: 16,
    normal: 17,
    loose: 19,
  },
};

// ─────────────────────────────────────────────
// Extended theme type (adds app-specific tokens)
// ─────────────────────────────────────────────
export type AppTheme = Theme & {
  colors: Theme['colors'] & {
    surface: string; // card background
    surfaceAlt: string; // subtle raised surface
    textMuted: string; // secondary text
    textFaint: string; // tertiary text
    gold: string; // premium accent
    goldDeep: string; // premium accent (light mode)
    article: string;
    video: string;
    image: string;
    link: string;
  };
  typography: AppTypography;
};

// ─────────────────────────────────────────────
// DARK — a study at night: ink navy, aged-paper
// text, brass reserved for premium, oxblood as
// the one deliberate accent color
// ─────────────────────────────────────────────
export const MyDarkTheme: AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#B04A56', // oxblood, lifted for legibility on ink
    background: '#0B1220',
    card: '#141C2E',
    text: '#EDE6D6', // warm cream, reads like paper under lamplight
    border: '#232E45',
    notification: '#C9A455',

    // App tokens
    surface: '#141C2E',
    surfaceAlt: '#1B2540',
    textMuted: '#9098AC',
    textFaint: '#5F6980',
    gold: '#D9B876', // brass, lifted for dark surfaces
    goldDeep: '#C9A455', // resting brass tone, used on lighter fills
    article: '#D97B4F',
    video: '#9B7FCB',
    image: '#CC6E93',
    link: '#5E8FC7',
  },
  typography,
};

// ─────────────────────────────────────────────
// LIGHT — parchment page, ink-navy text, the
// same oxblood/brass identity inverted
// ─────────────────────────────────────────────
export const MyLightTheme: AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#8C3A47',
    background: '#F7F3E8',
    card: '#EFE8D8',
    text: '#151E2E',
    border: '#DDD2B8',
    notification: '#A8823A',

    // App tokens
    surface: '#EFE8D8',
    surfaceAlt: '#FFFDF7',
    textMuted: '#5B5342',
    textFaint: '#7A7360',
    gold: '#A8823A',
    goldDeep: '#7C5F27', // deeper still, for fine text/small badges
    article: '#B3592F',
    video: '#6A4FA0',
    image: '#A3406A',
    link: '#38609A',
  },
  typography,
};
