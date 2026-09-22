import * as Clipboard from 'expo-clipboard';
import type { AppTheme } from '@/constants/theme';
import { useFocusEffect, useTheme } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { MasonryGrid } from './MasonryGrid';
import { FilterChips, type FilterOption } from './FilterChips';
import { SearchBar } from './SearchBar';
import { AddDock } from './AddDock';
import { PinActionMenu } from '@/components/Pin/PinActionMenu';
import { PinDetailPopover } from '@/components/Pin/PinDetailPopover';
import { usePins } from '@/hooks/usePins';
import { usePinMutations } from '@/hooks/usePinMutations';
import { consumeSavingComplete } from '@/hooks/pendingRefresh';
import type { BookmarkQuery, BookmarkType, Pin } from '@/types/bookmarks';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NEAR_BOTTOM = 240;

const TYPE_OPTIONS: FilterOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Article', value: 'article' },
  { label: 'Image', value: 'image' },
  { label: 'Link', value: 'link' },
  { label: 'Video', value: 'video' },
];

const STATUS_OPTIONS: FilterOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'Unread', value: 'unread' },
  { label: 'Archived', value: 'archived' },
];

type Overlay = { pin: Pin; mode: 'actions' | 'detail' } | null;

export function HomeScreen() {
  const theme = useTheme() as AppTheme;
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [active, setActive] = useState<Overlay>(null);

  const query = useMemo<BookmarkQuery>(
    () => ({
      search,
      archived: status === 'archived' ? true : false,
      type: type === 'all' ? undefined : (type as BookmarkType),
      favorite: status === 'favorites' ? true : undefined,
      unread: status === 'unread' ? true : undefined,
    }),
    [search, type, status]
  );

  const { pins, setPins, loading, refreshing, hasMore, error, loadMore, refresh } = usePins(query);

  // Keep the open popover in sync with optimistic mutations; close it when the
  // pin drops out of the current view (filter toggle or delete).
  const handleMutated = useCallback((id: number, updated: Pin | null) => {
    setActive((prev) => {
      if (!prev || prev.pin.id !== id) return prev;
      return updated ? { pin: updated, mode: prev.mode } : null;
    });
  }, []);

  const { toggleFavorite, toggleRead, toggleArchive, deletePin } = usePinMutations(
    pins,
    setPins,
    query,
    handleMutated
  );

  // Refetch page 0 when returning from the add-bookmark screen after a save.
  useFocusEffect(
    useCallback(() => {
      if (consumeSavingComplete()) void refresh();
    }, [refresh])
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isNearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - NEAR_BOTTOM;
    if (isNearBottom) loadMore();
  };

  const openLink = useCallback(
    (pin: Pin) => {
      if (!pin.isRead) toggleRead(pin);
      Linking.openURL(pin.url).catch(() => {
        Alert.alert('Could not open link', 'This link could not be opened.');
      });
    },
    [toggleRead]
  );

  const copyUrl = useCallback((pin: Pin) => {
    void Clipboard.setStringAsync(pin.url).then(() => {
      Alert.alert('Copied', 'Link copied to clipboard.');
    });
  }, []);

  const confirmDelete = useCallback(
    (pin: Pin) => {
      Alert.alert('Delete bookmark', `"${pin.title}" will be permanently removed.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePin(pin) },
      ]);
    },
    [deletePin]
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.colors.textMuted}
            colors={[theme.colors.textMuted]}
            progressBackgroundColor={theme.colors.card}
          />
        }>
        <View className="px-4 pb-4 pt-6">
          <View>
            <Text
              className="text-[28px] font-bold tracking-tight"
              style={{ color: theme.colors.text }}>
              Bookmarks
            </Text>
            <Text className="mt-0.5 text-[12px]" style={{ color: theme.colors.textMuted }}>
              Your saved inspiration
            </Text>
          </View>

          <View className="mt-3.5">
            <SearchBar value={search} onChangeText={setSearch} />
          </View>
          <View className="mt-3">
            <FilterChips options={TYPE_OPTIONS} selected={type} onSelect={setType} />
          </View>
          <View className="mt-2">
            <FilterChips options={STATUS_OPTIONS} selected={status} onSelect={setStatus} />
          </View>
        </View>

        {pins.length > 0 && (
          <MasonryGrid
            pins={pins}
            onPressPin={(pin) => setActive({ pin, mode: 'detail' })}
            onLongPressPin={(pin) => setActive({ pin, mode: 'actions' })}
            onPressMenu={(pin) => setActive({ pin, mode: 'actions' })}
          />
        )}

        <View className="py-6">
          {loading && <ActivityIndicator />}
          {!hasMore && pins.length > 0 && (
            <Text className="text-center text-[11px]" style={{ color: theme.colors.textFaint }}>
              {"You've reached the end"}
            </Text>
          )}
          {error && (
            <Text className="text-center text-[11px]" style={{ color: '#EF4444' }}>
              Something went wrong. Pull to retry.
            </Text>
          )}
          {!loading && !refreshing && pins.length === 0 && !error && (
            <Text
              className="mt-16 text-center text-[12px]"
              style={{ color: theme.colors.textMuted }}>
              No bookmarks yet.
            </Text>
          )}
        </View>
      </ScrollView>

      <AddDock />

      {active?.mode === 'actions' && (
        <PinActionMenu
          pin={active.pin}
          visible
          onClose={() => setActive(null)}
          onOpenLink={() => openLink(active.pin)}
          onViewDetails={() => setActive((prev) => (prev ? { ...prev, mode: 'detail' } : prev))}
          onToggleFavorite={() => toggleFavorite(active.pin)}
          onToggleRead={() => toggleRead(active.pin)}
          onToggleArchive={() => toggleArchive(active.pin)}
          onCopyUrl={() => copyUrl(active.pin)}
          onDelete={() => confirmDelete(active.pin)}
        />
      )}

      {active?.mode === 'detail' && (
        <PinDetailPopover
          pin={active.pin}
          visible
          onClose={() => setActive(null)}
          onOpenLink={() => openLink(active.pin)}
          onToggleFavorite={() => toggleFavorite(active.pin)}
          onToggleRead={() => toggleRead(active.pin)}
          onToggleArchive={() => toggleArchive(active.pin)}
          onCopyUrl={() => copyUrl(active.pin)}
          onDelete={() => confirmDelete(active.pin)}
        />
      )}
    </View>
  );
}
