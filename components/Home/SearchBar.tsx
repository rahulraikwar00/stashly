import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';

export const SearchBar = memo(function SearchBar({
  value,
  onChangeText,
  placeholder,
  trailing,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  trailing?: ReactNode;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  return (
    <View
      className="flex-row items-center rounded-full px-3.5 py-1.5"
      style={{ backgroundColor: c.surfaceAlt }}>
      <Ionicons name="search" size={16} color={c.textMuted} />
      <TextInput
        className="ml-2 flex-1 py-1 text-[14px]"
        style={{ color: c.text }}
        placeholder={placeholder ?? 'Search bookmarks…'}
        placeholderTextColor={c.textMuted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={c.textFaint} />
        </Pressable>
      )}
      {trailing}
    </View>
  );
});
