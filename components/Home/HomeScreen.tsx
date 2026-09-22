import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import {
  ActivityIndicator,
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
import { usePins } from '@/hooks/usePins';
import type { BookmarkQuery, BookmarkType } from '@/types/bookmarks';
import { useMemo, useState } from 'react';

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
];

export function HomeScreen() {
  const theme = useTheme() as AppTheme;
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');

  const query = useMemo<BookmarkQuery>(
    () => ({
      search,
      archived: false,
      type: type === 'all' ? undefined : (type as BookmarkType),
      favorite: status === 'favorites' ? true : undefined,
      unread: status === 'unread' ? true : undefined,
    }),
    [search, type, status]
  );

  const { pins, loading, refreshing, hasMore, error, loadMore, refresh } = usePins(query);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isNearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - NEAR_BOTTOM;
    if (isNearBottom) loadMore();
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
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
        <Text className="text-[28px] font-bold tracking-tight" style={{ color: theme.colors.text }}>
          Bookmarks
        </Text>
        <Text className="mt-0.5 text-[12px]" style={{ color: theme.colors.textMuted }}>
          Your saved inspiration
        </Text>

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

      {pins.length > 0 && <MasonryGrid pins={pins} />}

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
          <Text className="mt-16 text-center text-[12px]" style={{ color: theme.colors.textMuted }}>
            No bookmarks yet.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
