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

import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

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
};

// ─────────────────────────────────────────────
// DARK
// ─────────────────────────────────────────────
export const MyDarkTheme: AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#2A835F',
    background: '#092328',
    card: '#12544F',
    text: '#8BBB92',
    border: '#0E3B38',
    notification: '#C9A227',

    // App tokens
    surface: '#12544F',
    surfaceAlt: '#0E3B38',
    textMuted: '#5A8A7A',
    textFaint: '#4A6B63',
    gold: '#C9A227',
    goldDeep: '#C9A227',
    article: '#F97316',
    video: '#8B5CF6',
    image: '#EC4899',
    link: '#3B82F6',
  },
};

// ─────────────────────────────────────────────
// LIGHT
// ─────────────────────────────────────────────
export const MyLightTheme: AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1F6B4F',
    background: '#F5FAF7',
    card: '#E5F0E8',
    text: '#092328',
    border: '#C7DDD0',
    notification: '#B8860B',

    // App tokens
    surface: '#E5F0E8',
    surfaceAlt: '#FFFFFF',
    textMuted: '#4A6B63',
    textFaint: '#5A8A7A',
    gold: '#B8860B',
    goldDeep: '#B8860B',
    article: '#F97316',
    video: '#8B5CF6',
    image: '#EC4899',
    link: '#3B82F6',
  },
};
