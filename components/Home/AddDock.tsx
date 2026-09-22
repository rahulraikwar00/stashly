import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function AddDock({ onPress }: { onPress: () => void }) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 items-center"
      style={{ bottom: insets.bottom + 16 }}>
      <Pressable
        onPress={onPress}
        className="h-14 w-14 items-center justify-center rounded-full active:opacity-80"
        style={{
          backgroundColor: c.primary,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
