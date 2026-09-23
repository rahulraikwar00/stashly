import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { initialsFor } from '@/utils/profile';

export function UserAvatar({
  uri,
  name,
  size = 28,
  onPress,
  pressable = false,
}: {
  uri: string;
  name: string;
  size?: number;
  onPress?: () => void;
  pressable?: boolean;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  const content = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.primary,
      }}>
      {name.trim() ? (
        <Text className="font-bold" style={{ color: '#FFFFFF', fontSize: Math.round(size * 0.38) }}>
          {initialsFor(name)}
        </Text>
      ) : (
        <Ionicons
          name="person"
          size={Math.round(size * 0.6)}
          color={theme.dark ? '#FFFFFF' : 'rgba(0,0,0,0.55)'}
        />
      )}
    </View>
  );

  if (!pressable) return content;
  return (
    <Pressable onPress={onPress} hitSlop={8} className="active:opacity-70">
      {content}
    </Pressable>
  );
}
