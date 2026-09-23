import { PopupCard } from '@/components/Pin/PopupCard';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmRequest = ConfirmOptions & { resolve: (value: boolean) => void };

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

const DESTRUCTIVE = '#EF4444';

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const requestRef = useRef<ConfirmRequest | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        requestRef.current?.resolve(false);
        const next: ConfirmRequest = { ...options, resolve };
        requestRef.current = next;
        setRequest(next);
      }),
    []
  );

  const settle = (value: boolean) => {
    requestRef.current?.resolve(value);
    requestRef.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <PopupCard visible={!!request} onClose={() => settle(false)} maxWidth={300}>
        {request && (
          <View className="px-5 pb-5 pt-5">
            <Text className="text-[14px] font-bold" style={{ color: c.text }}>
              {request.title}
            </Text>
            {request.message ? (
              <Text className="mt-1.5 text-[12px] leading-[17px]" style={{ color: c.textMuted }}>
                {request.message}
              </Text>
            ) : null}
            <View className="mt-5 flex-row gap-2">
              <Pressable
                onPress={() => settle(false)}
                className="flex-1 items-center rounded-2xl py-2.5 active:opacity-70"
                style={{ backgroundColor: c.surfaceAlt }}>
                <Text className="text-[13px] font-semibold" style={{ color: c.text }}>
                  {request.cancelLabel ?? 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => settle(true)}
                className="flex-1 items-center rounded-2xl py-2.5 active:opacity-70"
                style={{ backgroundColor: request.destructive ? DESTRUCTIVE : c.primary }}>
                <Text className="text-[13px] font-bold" style={{ color: '#FFFFFF' }}>
                  {request.confirmLabel ?? 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </PopupCard>
    </ConfirmContext.Provider>
  );
}
