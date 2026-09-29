import type { Pin } from '@/types/bookmarks';
import { Image, Pressable, Text, View } from 'react-native';
import { useTheme } from 'expo-router';
import type { AppTheme } from '@/constants/theme';
import { memo } from 'react';
import { PinTypePill } from './PinTypePill';
import { typeColor } from '@/utils/pinColors';
import { formatRelativeTime } from '@/utils/pin';
import { Ionicons } from '@expo/vector-icons';

export const PinCard = memo(function PinCard({
  pin,
  imageHeight,
  onPress,
  onLongPress,
  onPressMenu,
  onToggleFavorite,
}: {
  pin: Pin;
  imageHeight: number;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressMenu?: () => void;
  onToggleFavorite?: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const t = theme.typography;

  return (
    <Pressable
      className="mb-2 w-full overflow-hidden rounded-2xl active:opacity-85"
      style={{ backgroundColor: c.surface, width: '100%' }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}>
      {pin.image ? (
        <View className="relative">
          <Image
            source={{ uri: pin.image }}
            style={{ width: '100%', height: imageHeight }}
            resizeMode="cover"
          />
          {pin.type !== 'article' && <PinTypePill type={pin.type} theme={theme} />}
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={6}
            className="absolute left-2 top-2 h-7 w-7 items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <Ionicons
              name={pin.isFavorite ? 'heart' : 'heart-outline'}
              size={15}
              color={pin.isFavorite ? c.gold : '#FFFFFF'}
            />
          </Pressable>
          <Pressable
            onPress={onPressMenu}
            hitSlop={6}
            className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <Ionicons name="ellipsis-horizontal" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      <View className="px-2.5 py-2">
        <View className="flex-row items-start">
          <Text
            className="flex-1 font-semibold"
            style={{
              color: c.text,
              fontSize: t.fontSize.card,
              lineHeight: t.lineHeight.compact,
            }}
            numberOfLines={2}>
            {pin.title}
          </Text>
          {!pin.image && (
            <Pressable
              onPress={onToggleFavorite}
              hitSlop={6}
              className="ml-1 p-0.5 active:opacity-60">
              <Ionicons
                name={pin.isFavorite ? 'heart' : 'heart-outline'}
                size={14}
                color={pin.isFavorite ? c.gold : c.textFaint}
              />
            </Pressable>
          )}
        </View>

        <View className="mt-1.5 flex-row items-center">
          <Image source={{ uri: pin.favicon }} className="h-3 w-3 rounded-[3px]" />
          <Text
            className="ml-1.5 flex-1"
            style={{ color: c.textFaint, fontSize: t.fontSize.caption }}
            numberOfLines={1}>
            {pin.source}
          </Text>
          <Text className="ml-1.5" style={{ color: c.textFaint, fontSize: t.fontSize.caption }}>
            · {formatRelativeTime(pin.createdAt)}
          </Text>
          {!pin.image && (
            <>
              <Text
                className="ml-1.5 font-bold tracking-widest"
                style={{ color: typeColor(pin.type, theme), fontSize: t.fontSize.micro }}>
                {pin.type.toUpperCase()}
              </Text>
              <Pressable onPress={onPressMenu} hitSlop={6} className="ml-1 p-0.5 active:opacity-60">
                <Ionicons name="ellipsis-horizontal" size={13} color={c.textFaint} />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
});
