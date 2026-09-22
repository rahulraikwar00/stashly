import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

export function PopupCard({
  visible,
  onClose,
  children,
  maxWidth = 320,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center px-6" onPress={onClose}>
        <View className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />
        <Pressable
          onPress={() => {}}
          className="w-full overflow-hidden rounded-3xl"
          style={{
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            maxWidth,
            maxHeight: '85%',
            elevation: 12,
            shadowColor: '#000',
            shadowOpacity: 0.35,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
          }}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
