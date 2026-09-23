import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import type { Pin } from '@/types/bookmarks';
import { Pressable, Text, View } from 'react-native';
import { PopupCard } from './PopupCard';

export function PinActionMenu({
  pin,
  visible,
  onClose,
  onOpenLink,
  onViewDetails,
  onEdit,
  onToggleFavorite,
  onToggleRead,
  onToggleArchive,
  onCopyUrl,
  onShare,
  onDelete,
}: {
  pin: Pin;
  visible: boolean;
  onClose: () => void;
  onOpenLink: () => void;
  onViewDetails: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onToggleRead: () => void;
  onToggleArchive: () => void;
  onCopyUrl: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  const rows = [
    {
      icon: 'open-outline',
      label: 'Open link',
      color: c.text,
      onPress: onOpenLink,
    },
    {
      icon: 'information-circle-outline',
      label: 'View details',
      color: c.text,
      onPress: onViewDetails,
    },
    {
      icon: 'pencil-outline',
      label: 'Edit',
      color: c.text,
      onPress: onEdit,
    },
    {
      icon: pin.isFavorite ? 'heart' : 'heart-outline',
      label: pin.isFavorite ? 'Remove from favorites' : 'Add to favorites',
      color: pin.isFavorite ? c.gold : c.text,
      onPress: onToggleFavorite,
    },
    {
      icon: pin.isRead ? 'checkmark-circle' : 'checkmark-circle-outline',
      label: pin.isRead ? 'Mark as unread' : 'Mark as read',
      color: pin.isRead ? c.primary : c.text,
      onPress: onToggleRead,
    },
    {
      icon: pin.isArchived ? 'archive' : 'archive-outline',
      label: pin.isArchived ? 'Unarchive' : 'Archive',
      color: pin.isArchived ? c.primary : c.text,
      onPress: onToggleArchive,
    },
    {
      icon: 'copy-outline',
      label: 'Copy URL',
      color: c.text,
      onPress: onCopyUrl,
    },
    {
      icon: 'share-outline',
      label: 'Share link',
      color: c.text,
      onPress: onShare,
    },
    {
      icon: 'trash-outline',
      label: 'Delete bookmark',
      color: '#EF4444',
      onPress: onDelete,
    },
  ] as const;

  return (
    <PopupCard visible={visible} onClose={onClose} maxWidth={300}>
      <View className="py-1">
        {rows.map((row, index) => (
          <View key={row.label}>
            {index > 0 && <View className="mx-4 h-px" style={{ backgroundColor: c.border }} />}
            <Pressable
              onPress={row.onPress}
              className="flex-row items-center px-4 py-3 active:opacity-60">
              <Ionicons name={row.icon} size={19} color={row.color} />
              <Text
                className="ml-3 text-[13px] font-semibold"
                style={{ color: row.color === '#EF4444' ? '#EF4444' : c.text }}>
                {row.label}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </PopupCard>
  );
}
