import { Ionicons } from '@expo/vector-icons';
import { PopupCard } from '@/components/Pin/PopupCard';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export type FilterGroup = 'type' | 'status' | 'sort';

type FilterChipDef = {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

const TYPE_CHIPS: FilterChipDef[] = [
  { value: 'all', label: 'All' },
  { value: 'article', label: 'Article' },
  { value: 'image', label: 'Image' },
  { value: 'link', label: 'Link' },
  { value: 'video', label: 'Video' },
];

const STATUS_CHIPS: FilterChipDef[] = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites', icon: 'heart' },
  { value: 'unread', label: 'Unread', icon: 'ellipse' },
  { value: 'archived', label: 'Archived', icon: 'archive-outline' },
];

const SORT_CHIPS: FilterChipDef[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'unread', label: 'Unread first', icon: 'ellipse' },
  { value: 'favorites', label: 'Favorites first', icon: 'heart' },
];

export function FilterPopover({
  visible,
  onClose,
  type,
  status,
  sort,
  tag,
  onSelectGroup,
  onClearTag,
}: {
  visible: boolean;
  onClose: () => void;
  type: string;
  status: string;
  sort: string;
  tag?: string;
  onSelectGroup: (group: FilterGroup, value: string) => void;
  onClearTag: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const t = theme.typography;

  const hasActiveFilters = type !== 'all' || status !== 'all' || !!tag;
  const selectedFor = (group: FilterGroup) => {
    if (group === 'type') return type;
    if (group === 'status') return status;
    return sort;
  };

  return (
    <PopupCard visible={visible} onClose={onClose} maxWidth={300}>
      <View className="px-4 pb-4 pt-3.5">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold" style={{ color: c.text, fontSize: t.fontSize.title }}>
            Filters
          </Text>
          <Pressable
            onPress={() => {
              onSelectGroup('type', 'all');
              onSelectGroup('status', 'all');
              onClearTag();
            }}
            disabled={!hasActiveFilters}
            hitSlop={8}>
            <Text
              className="font-semibold"
              style={{
                color: hasActiveFilters ? c.primary : c.textFaint,
                fontSize: t.fontSize.small,
              }}>
              Clear
            </Text>
          </Pressable>
        </View>

        {tag && (
          <View className="mt-3.5">
            <Text
              className="font-bold uppercase tracking-widest"
              style={{ color: c.textFaint, fontSize: t.fontSize.caption }}>
              Tag
            </Text>
            <View className="mt-1.5 flex-row items-center">
              <View
                className="flex-row items-center rounded-full py-1.5 pl-3 pr-1.5"
                style={{ backgroundColor: c.primary }}>
                <Text
                  className="font-semibold"
                  style={{ color: '#FFFFFF', fontSize: t.fontSize.card }}>
                  #{tag}
                </Text>
                <Pressable onPress={onClearTag} hitSlop={6} className="ml-1.5">
                  <Ionicons name="close" size={13} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <FilterSection
          label="Type"
          chips={TYPE_CHIPS}
          selected={selectedFor('type')}
          onSelect={(value) => onSelectGroup('type', value)}
        />
        <FilterSection
          label="Status"
          chips={STATUS_CHIPS}
          selected={selectedFor('status')}
          onSelect={(value) => onSelectGroup('status', value)}
        />
        <FilterSection
          label="Sort"
          chips={SORT_CHIPS}
          selected={selectedFor('sort')}
          onSelect={(value) => onSelectGroup('sort', value)}
        />
      </View>
    </PopupCard>
  );
}

function FilterSection({
  label,
  chips,
  selected,
  onSelect,
}: {
  label: string;
  chips: FilterChipDef[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const t = theme.typography;

  return (
    <View className="mt-3.5">
      <Text
        className="font-bold uppercase tracking-widest"
        style={{ color: c.textFaint, fontSize: t.fontSize.caption }}>
        {label}
      </Text>
      <View className="mt-1.5 flex-row flex-wrap gap-2">
        {chips.map((def) => {
          const active = def.value === selected;
          return (
            <Pressable
              key={def.value}
              onPress={() => onSelect(def.value)}
              className="flex-row items-center rounded-full px-3 py-1.5 active:opacity-80"
              style={{ backgroundColor: active ? c.primary : c.surfaceAlt }}>
              {def.icon && (
                <Ionicons
                  name={def.icon}
                  size={11}
                  color={active ? '#FFFFFF' : c.textMuted}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                className="font-semibold"
                style={{
                  color: active ? '#FFFFFF' : c.textMuted,
                  fontSize: t.fontSize.card,
                }}>
                {def.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
