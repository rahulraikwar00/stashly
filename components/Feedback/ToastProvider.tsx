import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info';

type ToastState = { message: string; type: ToastType };

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const ACCENTS: Record<ToastType, string> = {
  success: '#34D399',
  error: '#F87171',
  info: '#D9B876',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const insets = useSafeAreaInsets();

  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);
  const progressRef = useRef(progress);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    progressRef.current.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(setToast)(null);
    });
  }, [clearTimer]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      clearTimer();
      setToast({ message, type });
      progressRef.current.value = 0;
      progressRef.current.value = withTiming(1, { duration: 220 });
      timerRef.current = setTimeout(hide, type === 'error' ? 4000 : 2500);
    },
    [clearTimer, hide]
  );

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  useEffect(() => clearTimer, [clearTimer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  const accent = toast ? ACCENTS[toast.type] : c.gold;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Own transparent Modal so the toast floats above open popovers.
          box-none lets taps pass through to the app underneath.
          Rendered only while a toast exists — children would otherwise
          evaluate `toast.type` on null at mount. */}
      {toast && (
        <Modal transparent animationType="none" statusBarTranslucent onRequestClose={hide}>
          <View className="flex-1 justify-end" pointerEvents="box-none">
            <Animated.View
              pointerEvents="box-none"
              style={[animatedStyle, { marginBottom: insets.bottom + 96, paddingHorizontal: 16 }]}>
              <View className="items-center" pointerEvents="box-none">
                <Pressable
                  onPress={hide}
                  className="max-w-[400px] flex-row items-center rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor: c.surface,
                    borderWidth: 1,
                    borderColor: c.border,
                    elevation: 12,
                    shadowColor: '#000',
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 6 },
                  }}>
                  <Ionicons name={ICONS[toast.type]} size={17} color={accent} />
                  <Text
                    className="ml-2 flex-1 text-[13px]"
                    style={{ color: c.text }}
                    numberOfLines={2}>
                    {toast.message}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </ToastContext.Provider>
  );
}
