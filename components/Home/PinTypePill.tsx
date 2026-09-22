import type { AppTheme } from '@/constants/theme';
import type { BookmarkType } from '@/types/bookmarks';
import { Text, View } from 'react-native';
import { typeColor } from '@/utils/pinColors';

export function PinTypePill({ type, theme }: { type: BookmarkType; theme: AppTheme }) {
  return (
    <View className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-[3px]">
      <Text
        className="text-[9px] font-bold tracking-widest"
        style={{ color: typeColor(type, theme) }}>
        {type.toUpperCase()}
      </Text>
    </View>
  );
}
