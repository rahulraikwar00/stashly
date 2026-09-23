import { Ionicons } from '@expo/vector-icons';
import { PinTypePill } from '@/components/Home/PinTypePill';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import type { Pin } from '@/types/bookmarks';
import { formatPinDate, formatRelativeTime } from '@/utils/pin';
import { typeColor } from '@/utils/pinColors';
import { Image, Pressable, ScrollView, Text, View, type ColorValue } from 'react-native';
import { PopupCard } from './PopupCard';

export function PinDetailPopover({
  pin,
  visible,
  onClose,
  onOpenLink,
  onToggleFavorite,
  onToggleRead,
  onToggleArchive,
  onCopyUrl,
  onDelete,
}: {
  pin: Pin;
  visible: boolean;
  onClose: () => void;
  onOpenLink: () => void;
  onToggleFavorite: () => void;
  onToggleRead: () => void;
  onToggleArchive: () => void;
  onCopyUrl: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  return (
    <PopupCard visible={visible} onClose={onClose} maxWidth={340}>
      <View className="relative" style={{ flexShrink: 1 }}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          className="absolute right-2.5 top-2.5 z-10 h-8 w-8 items-center justify-center rounded-full active:opacity-70"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Ionicons name="close" size={16} color="#FFFFFF" />
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flexShrink: 1 }}>
          {pin.image ? (
            <View className="relative">
              <Image source={{ uri: pin.image }} className="h-[180px] w-full" resizeMode="cover" />
              {pin.type !== 'article' && <PinTypePill type={pin.type} theme={theme} />}
            </View>
          ) : null}

          <View className="px-4 pb-3 pt-3.5">
            <View className="flex-row items-center">
              <Image source={{ uri: pin.favicon }} className="h-3.5 w-3.5 rounded-[3px]" />
              <Text
                className="ml-1.5 flex-1 text-[11px]"
                style={{ color: c.textMuted }}
                numberOfLines={1}>
                {pin.source}
              </Text>
              <Text
                className="text-[9px] font-bold tracking-widest"
                style={{ color: typeColor(pin.type, theme) }}>
                {pin.type.toUpperCase()}
              </Text>
            </View>

            <Text className="mt-1.5 text-[15px] font-bold leading-[19px]" style={{ color: c.text }}>
              {pin.title}
            </Text>

            {pin.description ? (
              <Text className="mt-1 text-[12px] leading-[16px]" style={{ color: c.textMuted }}>
                {pin.description}
              </Text>
            ) : null}

            {pin.author ? (
              <Text className="mt-1.5 text-[11px]" style={{ color: c.textFaint }}>
                By {pin.author}
              </Text>
            ) : null}

            {pin.tags.length > 0 && (
              <View className="mt-2.5 flex-row flex-wrap">
                {pin.tags.map((tag) => (
                  <View
                    key={tag}
                    className="mb-1.5 mr-1.5 rounded-full px-2.5 py-1"
                    style={{ backgroundColor: c.surfaceAlt }}>
                    <Text className="text-[10px] font-semibold" style={{ color: c.textMuted }}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {pin.notes ? (
              <View
                className="mt-2.5 rounded-xl px-3 py-2"
                style={{ backgroundColor: c.surfaceAlt }}>
                <Text className="text-[11px] leading-[15px]" style={{ color: c.text }}>
                  {pin.notes}
                </Text>
              </View>
            ) : null}

            <View className="mt-2.5 flex-row items-center">
              <Ionicons name="link" size={12} color={c.textFaint} />
              <Text
                className="ml-1.5 flex-1 text-[10px]"
                style={{ color: c.textFaint }}
                numberOfLines={1}>
                {pin.url}
              </Text>
            </View>

            <View className="mt-1 flex-row items-center">
              <Ionicons name="time-outline" size={12} color={c.textFaint} />
              <Text className="ml-1.5 text-[10px]" style={{ color: c.textFaint }}>
                Added {formatRelativeTime(pin.createdAt)} ago · {formatPinDate(pin.createdAt)}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View className="border-t px-4 pb-3 pt-2.5" style={{ borderColor: c.border }}>
          <Pressable
            onPress={onOpenLink}
            className="items-center rounded-2xl py-2.5 active:opacity-80"
            style={{ backgroundColor: c.primary }}>
            <Text className="text-[13px] font-bold" style={{ color: '#FFFFFF' }}>
              Open link
            </Text>
          </Pressable>

          <View className="mt-2 flex-row justify-between px-2">
            <DetailIcon
              name={pin.isFavorite ? 'heart' : 'heart-outline'}
              color={pin.isFavorite ? c.gold : c.textFaint}
              onPress={onToggleFavorite}
            />
            <DetailIcon
              name={pin.isRead ? 'checkmark-circle' : 'checkmark-circle-outline'}
              color={pin.isRead ? c.primary : c.textFaint}
              onPress={onToggleRead}
            />
            <DetailIcon
              name={pin.isArchived ? 'archive' : 'archive-outline'}
              color={pin.isArchived ? c.primary : c.textFaint}
              onPress={onToggleArchive}
            />
            <DetailIcon name="copy-outline" color={c.textFaint} onPress={onCopyUrl} />
            <DetailIcon name="trash-outline" color="#EF4444" onPress={onDelete} />
          </View>
        </View>
      </View>
    </PopupCard>
  );
}

function DetailIcon({
  name,
  color,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} className="rounded-lg p-2 active:opacity-60">
      <Ionicons name={name} size={20} color={color} />
    </Pressable>
  );
}
