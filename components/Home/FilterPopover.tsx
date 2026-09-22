import { Ionicons } from '@expo/vector-icons';
import { PopupCard } from '@/components/Pin/PopupCard';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export type FilterGroup = 'type' | 'status';

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

export function FilterPopover({
  visible,
  onClose,
  type,
  status,
  onSelectGroup,
}: {
  visible: boolean;
  onClose: () => void;
  type: string;
  status: string;
  onSelectGroup: (group: FilterGroup, value: string) => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  const hasActiveFilters = type !== 'all' || status !== 'all';
  const selectedFor = (group: FilterGroup) => (group === 'type' ? type : status);

  return (
    <PopupCard visible={visible} onClose={onClose} maxWidth={300}>
      <View className="px-4 pb-4 pt-3.5">
        <View className="flex-row items-center justify-between">
          <Text className="text-[14px] font-bold" style={{ color: c.text }}>
            Filters
          </Text>
          <Pressable
            onPress={() => {
              onSelectGroup('type', 'all');
              onSelectGroup('status', 'all');
            }}
            disabled={!hasActiveFilters}
            hitSlop={8}>
            <Text
              className="text-[11px] font-semibold"
              style={{ color: hasActiveFilters ? c.primary : c.textFaint }}>
              Clear
            </Text>
          </Pressable>
        </View>

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

  return (
    <View className="mt-3.5">
      <Text
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: c.textFaint }}>
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
                className="text-[12px] font-semibold"
                style={{ color: active ? '#FFFFFF' : c.textMuted }}>
                {def.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
