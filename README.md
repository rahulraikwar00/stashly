# Stashly

> A private, offline-first bookmark app for saving links and Instagram Reels.

Stashly turns your saved links into a **Pinterest-style visual board** on your phone.

Everything is stored **locally on your device using SQLite** — no account, no cloud, and no dependency on the internet for your library.

Save a link, and Stashly automatically fills in its **title, thumbnail, favicon, and other metadata** in the background.

---

## What can you save?

There are two ways to add content:

### 1. Paste or Share

Paste a URL into Stashly, or share a link from any app using your phone's **Share** menu.

The link is saved immediately, even when you're offline. Metadata can be added later when a network connection is available.

### 2. Instagram DM Sync

You can optionally connect your Instagram account and forward Reels to a linked DM conversation.

Stashly then imports them into your library along with information such as:

- Caption
- Hashtags
- Reel URL

> Instagram sync requires the optional self-hosted FastAPI backend.

---

## Features

### Visual bookmark board

- Pinterest-style masonry grid
- 2, 3, or 4-column layout
- Fast scrolling with FlashList
- Rich visual cards with thumbnails and metadata

### Search & filters

- Search titles, descriptions, tags, notes, and URLs
- Filter by content type
- Filter favorites, unread, or archived bookmarks
- Filter by tag
- Sort by newest, oldest, unread, or favorites

### Bookmark management

- Open links
- Favorite
- Mark as read/unread
- Archive
- Edit title and description
- Add notes and tags
- Copy URL
- Share
- Delete

All actions are designed to feel instant with optimistic updates.

### Automatic metadata

When you save a URL, Stashly can automatically fetch:

- Title
- Thumbnail
- Favicon
- Description
- Other page metadata

Your manual edits always take priority and won't be overwritten.

### Offline-first

Your library works without an internet connection.

You can still:

- Browse bookmarks
- Search
- Edit bookmarks
- Add tags and notes
- Favorite items
- Archive items

The network is only needed for things like **metadata enrichment and Instagram sync**.

### Backup & restore

Export your entire library as a versioned JSON backup.

You can restore it later by importing the backup. Imports are idempotent, so importing the same backup twice won't create duplicates.

### No duplicate URLs

The same URL always maps to the same bookmark, preventing accidental duplicates.

### Profile & settings

Customize:

- Profile
- Theme
- Default view
- Metadata extractor
- Instagram sync

---

# Tech Stack

- **Expo SDK 57**
- **React Native 0.86**
- **TypeScript**
- **Expo Router**
- **SQLite**
- **Drizzle ORM**
- **NativeWind / Tailwind CSS**
- **React Native Reanimated**
- **FlashList**
- **Expo Sharing**
- **EAS Build / EAS Update**

---

# Getting Started

## Requirements

You'll need:

- Node.js 20+
- npm
- Android Studio + Android SDK for Android development
- macOS + Xcode for iOS development
- An Expo account for EAS builds

---

## Run the project

Clone the repository:

```bash
git clone https://github.com/rahulraikwar00/stashly.git
cd stashly
npm install
```

### Development build

For the full native experience, including receiving shared links:

```bash
npx expo run:android
```

or:

```bash
npx expo run:ios
```

### Expo Go

For a quick preview:

```bash
npx expo start
```

> **Note:** The system Share → Stashly functionality requires a development or production build. It does not work in Expo Go.

---

# Build an APK

You can create an installable Android APK using EAS:

```bash
npx eas-cli build -p android --profile preview
```

The `preview` profile creates an APK for internal distribution.

Once the build is finished, download the APK from the EAS dashboard and install it on your phone.

You can also install it with ADB:

```bash
adb install stashly.apk
```

---

# Metadata Extractor

Stashly can use a self-hosted metadata extractor to fetch information such as titles and thumbnails.

To configure one before the first launch:

```bash
cp .env.example .env
```

The URL can later be changed from the app's settings.

---

# Instagram Sync

Instagram sync is optional.

The basic flow is:

```text
Instagram
    ↓
Forward Reel to DM
    ↓
Stashly Backend
    ↓
Stashly App
    ↓
Local SQLite Library
```

The companion FastAPI backend is maintained separately from this repository.

See the [Architecture](docs/02-Architecture.md) documentation for details.

---

# Project Structure

```text
stashly/
│
├── src/app/          # App routes and screens
├── components/       # UI components
├── db/               # SQLite, Drizzle and database services
├── drizzle/          # Database migrations
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
├── types/            # Shared TypeScript types
├── constants/        # Shared constants
├── docs/              # Product and technical documentation
└── DesingDecision/   # Architecture decision records
```

---

# Documentation

More detailed documentation is available here:

- [Product Requirements](docs/01-PRD.md)
- [Architecture](docs/02-Architecture.md)
- [API Contract](docs/03-API-Contract.md)
- [Implementation Plan](docs/04-Implementation-Plan.md)
- [Decision Records](DesingDecision/decisions.md)

---

# Philosophy

Stashly is built around a simple idea:

> **Your bookmarks should belong to you.**

No account.

No cloud library.

No subscription.

Just your links, stored locally on your phone and available whenever you need them.

---

## License

Not licensed yet.
