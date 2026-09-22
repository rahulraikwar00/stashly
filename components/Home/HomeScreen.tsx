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
import { usePins } from '@/hooks/usePins';

const NEAR_BOTTOM = 240;

export function HomeScreen() {
  const theme = useTheme() as AppTheme;
  const { pins, loading, refreshing, hasMore, error, loadMore, refresh } = usePins();

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
