import type { AppTheme } from "@/constants/theme";
import type { BookmarkType, Pin } from "@/types/bookmarks";
import { useTheme } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

// Mock data
const pins: Pin[] = [
  {
    id: "1",
    title: "The Quiet Luxury of Slowness",
    description:
      "A meditation on why doing less, better, is the ultimate luxury in a world obsessed with speed.",
    source: "kinfolk.com",
    favicon: "https://www.google.com/s2/favicons?domain=kinfolk.com&sz=64",
    image: "https://picsum.photos/seed/a/400/600",
    tags: ["design", "mindful"],
    type: "article",
    height: 220,
  },
  {
    id: "2",
    title: "Crafting Interfaces That Breathe",
    description:
      "How whitespace, rhythm, and restraint create digital products that feel alive.",
    source: "vimeo.com",
    favicon: "https://www.google.com/s2/favicons?domain=vimeo.com&sz=64",
    image: "https://picsum.photos/seed/b/400/700",
    tags: ["ui", "video"],
    type: "video",
    height: 300,
  },
  {
    id: "3",
    title: "On Taste, Restraint, and Detail",
    description:
      "The Aesop philosophy applied to digital interfaces — quiet, considered, timeless.",
    source: "aesop.com",
    favicon: "https://www.google.com/s2/favicons?domain=aesop.com&sz=64",
    image: "https://picsum.photos/seed/c/400/650",
    tags: ["branding"],
    type: "article",
    height: 260,
  },
  {
    id: "4",
    title: "Designing With Sage & Gold",
    description:
      "A color study on pairing muted greens with warm metallics for a premium feel.",
    source: "dribbble.com",
    favicon: "https://www.google.com/s2/favicons?domain=dribbble.com&sz=64",
    image: "https://picsum.photos/seed/d/400/500",
    tags: ["color", "inspo"],
    type: "link",
    height: 180,
  },
  {
    id: "5",
    title: "The Art of Slow Reading",
    description:
      "Why the best ideas need time — and how to build a reading habit that lasts.",
    source: "medium.com",
    favicon: "https://www.google.com/s2/favicons?domain=medium.com&sz=64",
    image: "https://picsum.photos/seed/e/400/680",
    tags: ["reading", "habits"],
    type: "article",
    height: 280,
  },
  {
    id: "6",
    title: "A Film About Type",
    description:
      "A short documentary on the craftspeople who shape the letters we read every day.",
    source: "youtube.com",
    favicon: "https://www.google.com/s2/favicons?domain=youtube.com&sz=64",
    image: "https://picsum.photos/seed/f/400/620",
    tags: ["typography"],
    type: "video",
    height: 240,
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function typeColor(type: BookmarkType, theme: AppTheme): string {
  switch (type) {
    case "article":
      return theme.colors.article;
    case "video":
      return theme.colors.video;
    case "image":
      return theme.colors.image;
    case "link":
      return theme.colors.link;
  }
}

function splitColumns(items: Pin[]) {
  const left: Pin[] = [];
  const right: Pin[] = [];
  let leftH = 0,
    rightH = 0;
  for (const pin of items) {
    if (leftH <= rightH) {
      left.push(pin);
      leftH += pin.height;
    } else {
      right.push(pin);
      rightH += pin.height;
    }
  }
  return { left, right };
}

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────
export default function Home() {
  const theme = useTheme() as AppTheme;
  const { left, right } = splitColumns(pins);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View className="px-4 pt-4 pb-16">
        {/* Header */}
        <View className="mb-5">
          <Text
            className="text-[11px] tracking-premium font-bold mb-1"
            style={{ color: theme.colors.gold }}
          >
            YOUR LIBRARY
          </Text>
          <Text
            className="text-[34px] font-light tracking-wide"
            style={{ color: theme.colors.text }}
          >
            Bookmarks
          </Text>
        </View>

        {/* 2-Column Masonry */}
        <View className="flex-row gap-3">
          <View className="flex-1 gap-3">
            {left.map((pin) => (
              <PinCard key={pin.id} pin={pin} />
            ))}
          </View>
          <View className="flex-1 gap-3">
            {right.map((pin) => (
              <PinCard key={pin.id} pin={pin} />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────
function PinCard({ pin }: { pin: Pin }) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  return (
    <Pressable
      className="rounded-premium overflow-hidden active:opacity-80"
      style={{
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      {/* Cover image + type badge */}
      <View className="relative">
        <Image
          source={{ uri: pin.image }}
          style={{ width: "100%", height: pin.height }}
          resizeMode="cover"
        />
        <View
          className="absolute top-2 right-2 rounded-full px-2 py-0.5"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <Text
            className="text-[9px] font-bold tracking-wide2"
            style={{ color: typeColor(pin.type, theme) }}
          >
            {pin.type.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View className="p-3">
        {/* Source: favicon + name */}
        <View className="flex-row items-center mb-2">
          <Image
            source={{ uri: pin.favicon }}
            style={{ width: 14, height: 14, borderRadius: 3 }}
          />
          <Text
            className="text-[10px] tracking-wide ml-1.5"
            style={{ color: c.textFaint }}
            numberOfLines={1}
          >
            {pin.source}
          </Text>
        </View>

        {/* Title */}
        <Text
          className="text-[13px] font-medium tracking-wide leading-4"
          style={{ color: c.text }}
          numberOfLines={2}
        >
          {pin.title}
        </Text>

        {/* Description */}
        <Text
          className="text-[11px] mt-1.5 leading-4"
          style={{ color: c.textMuted }}
          numberOfLines={2}
        >
          {pin.description}
        </Text>

        {/* Tags */}
        <View className="flex-row flex-wrap gap-1.5 mt-2.5">
          {pin.tags.map((tag: string) => (
            <View
              key={tag}
              className="rounded-full px-2 py-[3px]"
              style={{ backgroundColor: c.surfaceAlt }}
            >
              <Text
                className="text-[9px] font-medium tracking-wide"
                style={{ color: c.textMuted }}
              >
                #{tag}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}
