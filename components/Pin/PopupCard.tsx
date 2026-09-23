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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1">
        {/* Full-bleed backdrop, sibling of the card (not a parent) so the
            card's ScrollView keeps the touch responder while scrolling.
            Parent has no padding, so inset-0 covers the whole screen. */}
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        />
        <View className="flex-1 items-center justify-center px-6" pointerEvents="box-none">
          <View
            className="w-full overflow-hidden rounded-3xl"
            style={{
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              maxWidth,
              maxHeight: '85%',
              flexShrink: 1,
              elevation: 12,
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
            }}>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
}
