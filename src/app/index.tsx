import type { AppTheme } from '@/constants/theme';
import type { BookmarkType, Pin } from '@/types/bookmarks';
import { useTheme } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

// ─────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────

const pins: Pin[] = [
  {
    id: '1',
    title: 'The Quiet Luxury of Slowness',
    description:
      'A meditation on why doing less, better, is the ultimate luxury in a world obsessed with speed.',
    source: 'kinfolk.com',
    favicon: 'https://www.google.com/s2/favicons?domain=kinfolk.com&sz=64',
    image: 'https://picsum.photos/seed/a/400/600',
    tags: ['design', 'mindful'],
    type: 'article',
    height: 220,
  },
  {
    id: '2',
    title: 'Crafting Interfaces That Breathe',
    description: 'How whitespace, rhythm, and restraint create digital products that feel alive.',
    source: 'vimeo.com',
    favicon: 'https://www.google.com/s2/favicons?domain=vimeo.com&sz=64',
    image: 'https://picsum.photos/seed/b/400/700',
    tags: ['ui', 'video'],
    type: 'video',
    height: 300,
  },
  {
    id: '3',
    title: 'On Taste, Restraint, and Detail',
    description:
      'The Aesop philosophy applied to digital interfaces — quiet, considered, timeless.',
    source: 'aesop.com',
    favicon: 'https://www.google.com/s2/favicons?domain=aesop.com&sz=64',
    image: 'https://picsum.photos/seed/c/400/650',
    tags: ['branding'],
    type: 'article',
    height: 260,
  },
  {
    id: '4',
    title: 'Designing With Sage & Gold',
    description: 'A color study on pairing muted greens with warm metallics for a premium feel.',
    source: 'dribbble.com',
    favicon: 'https://www.google.com/s2/favicons?domain=dribbble.com&sz=64',
    image: 'https://picsum.photos/seed/d/400/500',
    tags: ['color', 'inspo'],
    type: 'link',
    height: 180,
  },
  {
    id: '5',
    title: 'The Art of Slow Reading',
    description: 'Why the best ideas need time — and how to build a reading habit that lasts.',
    source: 'medium.com',
    favicon: 'https://www.google.com/s2/favicons?domain=medium.com&sz=64',
    image: 'https://picsum.photos/seed/e/400/680',
    tags: ['reading', 'habits'],
    type: 'article',
    height: 280,
  },
  {
    id: '6',
    title: 'A Film About Type',
    description: 'A short documentary on the craftspeople who shape the letters we read every day.',
    source: 'youtube.com',
    favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
    image: 'https://picsum.photos/seed/f/400/620',
    tags: ['typography'],
    type: 'video',
    height: 240,
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function typeColor(type: BookmarkType, theme: AppTheme): string {
  switch (type) {
    case 'article':
      return theme.colors.article;
    case 'video':
      return theme.colors.video;
    case 'image':
      return theme.colors.image;
    case 'link':
    default:
      return theme.colors.link;
  }
}

function splitColumns(items: Pin[]) {
  const left: Pin[] = [];
  const right: Pin[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  for (const pin of items) {
    if (leftHeight <= rightHeight) {
      left.push(pin);
      leftHeight += pin.height;
    } else {
      right.push(pin);
      rightHeight += pin.height;
    }
  }
  return { left, right };
}

export default function Home() {
  const theme = useTheme() as AppTheme;
  const { left, right } = splitColumns(pins);

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerClassName="pb-8"
      showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="px-4 pb-4 pt-6">
        <Text className="text-[28px] font-bold tracking-tight" style={{ color: theme.colors.text }}>
          Bookmarks
        </Text>
        <Text className="mt-0.5 text-[12px]" style={{ color: theme.colors.textMuted }}>
          Your saved inspiration
        </Text>
      </View>

      {/* Masonry grid — 8px outer gutter */}
      <View className="flex-row px-2">
        {/* LEFT COLUMN */}
        <View className="flex-1 pr-1">
          {left.map((pin) => (
            <PinCard key={pin.id} pin={pin} theme={theme} />
          ))}
        </View>

        {/* RIGHT COLUMN */}
        <View className="flex-1 pl-1">
          {right.map((pin) => (
            <PinCard key={pin.id} pin={pin} theme={theme} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function PinCard({ pin, theme }: { pin: Pin; theme: AppTheme }) {
  const colors = theme.colors;

  return (
    <Pressable
      className="mb-2 overflow-hidden rounded-2xl active:opacity-85"

      style={{ backgroundColor: colors.surface }}>
      {/* Image is the hero */}
      <View className="relative">
        <Image
          source={{ uri: pin.image }}
          style={{ width: '100%', height: pin.height }}
          resizeMode="cover"
        />

        {/* Subtle type pill — bottom-left, only for non-article */}
        {pin.type !== 'article' && (
          <View className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-[3px]">
            <Text
              className="text-[9px] font-bold tracking-widest"
              style={{ color: typeColor(pin.type, theme) }}>
              {pin.type.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Compact caption bar */}
      <View className="px-2.5 py-2">
        <Text
          className="text-[12px] font-semibold leading-4"
          style={{ color: colors.text }}
          numberOfLines={2}>
          {pin.title}
        </Text>

        <View className="mt-1.5 flex-row items-center">
          <Image source={{ uri: pin.favicon }} className="h-3 w-3 rounded-[3px]" />
          <Text
            className="ml-1.5 text-[10px]"
            style={{ color: colors.textFaint }}
            numberOfLines={1}>
            {pin.source}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
