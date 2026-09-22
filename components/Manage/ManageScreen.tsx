import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  ColorValue,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useMemo, useState } from 'react';
import type { BookmarkQuery, Pin } from '@/types/bookmarks';
import { deleteBookmark, setArchived, setFavorite, setRead } from '@/db/bookmarkService';
import { usePins } from '@/hooks/usePins';
import { typeColor } from '@/utils/pinColors';

type Scope = 'all' | 'favorites' | 'unread' | 'archived';

const SCOPES: { label: string; value: Scope }[] = [
  { label: 'All', value: 'all' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'Unread', value: 'unread' },
  { label: 'Archived', value: 'archived' },
];

function scopeToQuery(scope: Scope): BookmarkQuery {
  switch (scope) {
    case 'favorites':
      return { favorite: true };
    case 'unread':
      return { unread: true };
    case 'archived':
      return { archived: true };
    case 'all':
    default:
      return {};
  }
}

function matchesScope(pin: Pin, scope: Scope): boolean {
  switch (scope) {
    case 'favorites':
      return pin.isFavorite;
    case 'unread':
      return !pin.isRead;
    case 'archived':
      return pin.isArchived;
    case 'all':
    default:
      return true;
  }
}

export function ManageScreen() {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const [scope, setScope] = useState<Scope>('all');

  const query = useMemo(() => scopeToQuery(scope), [scope]);
  const { pins, setPins, loading, refreshing, hasMore, error, loadMore, refresh } = usePins(query);

  const applyOptimistic = (id: number, updater: (p: Pin) => Pin, run: () => Promise<unknown>) => {
    const snapshot = pins;
    setPins((current) => {
      const target = current.find((p) => p.id === id);
      if (!target) return current;
      const updated = updater(target);
      return matchesScope(updated, scope)
        ? current.map((p) => (p.id === id ? updated : p))
        : current.filter((p) => p.id !== id);
    });
    run().catch((err: unknown) => {
      console.error('Optimistic update failed:', err);
      setPins(snapshot);
    });
  };

  const toggleFavorite = (pin: Pin) =>
    applyOptimistic(
      pin.id,
      (p) => ({ ...p, isFavorite: !p.isFavorite }),
      () => setFavorite(pin.id, !pin.isFavorite)
    );

  const toggleArchived = (pin: Pin) =>
    applyOptimistic(
      pin.id,
      (p) => ({ ...p, isArchived: !p.isArchived }),
      () => setArchived(pin.id, !pin.isArchived)
    );

  const toggleRead = (pin: Pin) =>
    applyOptimistic(
      pin.id,
      (p) => ({ ...p, isRead: !p.isRead }),
      () => setRead(pin.id, !pin.isRead)
    );

  const deleteRow = (pin: Pin) => {
    const snapshot = pins;
    setPins((current) => current.filter((p) => p.id !== pin.id));
    deleteBookmark(pin.id).catch((err: unknown) => {
      console.error('Delete failed:', err);
      setPins(snapshot);
    });
  };

  const confirmDelete = (pin: Pin) => {
    Alert.alert('Delete bookmark', `"${pin.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRow(pin) },
    ]);
  };

  const renderItem = ({ item }: { item: Pin }) => (
    <ManageRow
      pin={item}
      theme={theme}
      onToggleFavorite={() => toggleFavorite(item)}
      onToggleArchived={() => toggleArchived(item)}
      onToggleRead={() => toggleRead(item)}
      onRequestDelete={() => confirmDelete(item)}
    />
  );

  return (
    <View className="flex-1" style={{ backgroundColor: c.background }}>
      <View className="px-4 pb-2 pt-6">
        <Text className="text-[28px] font-bold tracking-tight" style={{ color: c.text }}>
          Manage
        </Text>
        <Text className="mt-0.5 text-[12px]" style={{ color: c.textMuted }}>
          Organize your saved bookmarks
        </Text>
      </View>

      <View className="mb-2 flex-row gap-2 px-4">
        {SCOPES.map((s) => {
          const active = s.value === scope;
          return (
            <Pressable
              key={s.value}
              onPress={() => setScope(s.value)}
              className="rounded-full px-3 py-1.5 active:opacity-80"
              style={{ backgroundColor: active ? c.primary : c.surfaceAlt }}>
              <Text
                className="text-[12px] font-semibold"
                style={{ color: active ? '#FFFFFF' : c.textMuted }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={pins}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={() => loadMore()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={c.textMuted}
            colors={[c.textMuted]}
            progressBackgroundColor={c.card}
          />
        }
        ListEmptyComponent={
          <View className="py-16">
            {loading ? (
              <ActivityIndicator />
            ) : error ? (
              <Text className="text-center text-[12px]" style={{ color: '#EF4444' }}>
                Something went wrong. Pull to retry.
              </Text>
            ) : (
              <Text className="text-center text-[12px]" style={{ color: c.textMuted }}>
                No bookmarks here.
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          loading && pins.length > 0 ? (
            <ActivityIndicator />
          ) : !hasMore && pins.length > 0 ? (
            <Text className="mt-4 text-center text-[11px]" style={{ color: c.textFaint }}>
              {"You've reached the end"}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

function ManageRow({
  pin,
  theme,
  onToggleFavorite,
  onToggleArchived,
  onToggleRead,
  onRequestDelete,
}: {
  pin: Pin;
  theme: AppTheme;
  onToggleFavorite: () => void;
  onToggleArchived: () => void;
  onToggleRead: () => void;
  onRequestDelete: () => void;
}) {
  const c = theme.colors;

  return (
    <View
      className="flex-row items-center rounded-2xl p-2.5"
      style={{ backgroundColor: c.surface }}>
      <Image
        source={{ uri: pin.image }}
        className="h-[52px] w-[52px] rounded-xl"
        resizeMode="cover"
      />

      <View className="ml-3 flex-1">
        <Text
          className="text-[13px] font-semibold leading-[17px]"
          style={{ color: c.text }}
          numberOfLines={2}>
          {pin.title}
        </Text>
        <Text className="mt-1 text-[10px]" style={{ color: c.textFaint }} numberOfLines={1}>
          {pin.source}
        </Text>
        <Text
          className="text-[9px] font-bold tracking-widest"
          style={{ color: typeColor(pin.type, theme) }}>
          {pin.type.toUpperCase()}
        </Text>
      </View>

      <View className="ml-2">
        <View className="flex-row">
          <IconButton
            name={pin.isFavorite ? 'heart' : 'heart-outline'}
            color={pin.isFavorite ? c.gold : c.textFaint}
            onPress={onToggleFavorite}
          />
          <IconButton
            name={pin.isArchived ? 'archive' : 'archive-outline'}
            color={pin.isArchived ? c.primary : c.textFaint}
            onPress={onToggleArchived}
          />
        </View>
        <View className="flex-row">
          <IconButton
            name={pin.isRead ? 'checkmark-circle' : 'checkmark-circle-outline'}
            color={pin.isRead ? c.primary : c.textFaint}
            onPress={onToggleRead}
          />
          <IconButton name="trash-outline" color="#EF4444" onPress={onRequestDelete} />
        </View>
      </View>
    </View>
  );
}

function IconButton({
  name,
  color,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={4} className="rounded-lg p-1.5 active:opacity-60">
      <Ionicons name={name} size={19} color={color} />
    </Pressable>
  );
}
