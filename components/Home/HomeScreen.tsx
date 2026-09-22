import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { PinCard } from './PinCard';
import { usePins } from '@/hooks/usePins';

export function HomeScreen() {
  const theme = useTheme() as AppTheme;
  const { pins, loading, hasMore, error, loadMore } = usePins();

  return (
    <FlatList
      data={pins}
      numColumns={2}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <PinCard pin={item} />}
      columnWrapperStyle={{ paddingHorizontal: 8, gap: 8 }}
      contentContainerStyle={{ paddingBottom: 32 }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: theme.colors.background }}
      ListHeaderComponent={
        <View className="px-4 pb-4 pt-6">
          <Text
            className="text-[28px] font-bold tracking-tight"
            style={{ color: theme.colors.text }}>
            Bookmarks
          </Text>
          <Text className="mt-0.5 text-[12px]" style={{ color: theme.colors.textMuted }}>
            Your saved inspiration
          </Text>
        </View>
      }
      ListFooterComponent={
        <View className="py-6">
          {loading && <ActivityIndicator />}
          {!hasMore && pins.length > 0 && (
            <Text className="text-center text-[11px]" style={{ color: theme.colors.textFaint }}>
              You've reached the end
            </Text>
          )}
          {error && (
            <Text className="text-center text-[11px]" style={{ color: '#EF4444' }}>
              Something went wrong. Pull to retry.
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <Text className="mt-16 text-center text-[12px]" style={{ color: theme.colors.textMuted }}>
            No bookmarks yet.
          </Text>
        ) : null
      }
    />
  );
}
