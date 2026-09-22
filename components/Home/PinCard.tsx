import type { Pin } from '@/types/bookmarks';
import { Image, Pressable, Text, View } from 'react-native';
import { useTheme } from 'expo-router';
import type { AppTheme } from '@/constants/theme';
import { PinTypePill } from './PinTypePill';

export function PinCard({ pin }: { pin: Pin }) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  return (
    <Pressable
      className="mb-2 overflow-hidden rounded-2xl active:opacity-85"
      style={{ backgroundColor: c.surface }}>
      <View className="relative">
        <Image
          source={{ uri: pin.image }}
          style={{ width: '100%', height: pin.height }}
          resizeMode="cover"
        />
        {pin.type !== 'article' && <PinTypePill type={pin.type} theme={theme} />}
      </View>

      <View className="px-2.5 py-2">
        <Text
          className="text-[12px] font-semibold leading-4"
          style={{ color: c.text }}
          numberOfLines={2}>
          {pin.title}
        </Text>

        <View className="mt-1.5 flex-row items-center">
          <Image source={{ uri: pin.favicon }} className="h-3 w-3 rounded-[3px]" />
          <Text className="ml-1.5 text-[10px]" style={{ color: c.textFaint }} numberOfLines={1}>
            {pin.source}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
