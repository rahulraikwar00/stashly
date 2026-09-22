import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';

export type FilterOption = { label: string; value: string };

export function FilterChips({
  options,
  selected,
  onSelect,
}: {
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            className="rounded-full px-3 py-1.5 active:opacity-80"
            style={{ backgroundColor: active ? c.primary : c.surfaceAlt }}>
            <Text
              className="text-[12px] font-semibold"
              style={{ color: active ? '#FFFFFF' : c.textMuted }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
