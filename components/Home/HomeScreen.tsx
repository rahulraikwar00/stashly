import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, Share, Text, View } from 'react-native';
import { useToast } from '@/components/Feedback/ToastProvider';
import { useConfirm } from '@/components/Feedback/ConfirmProvider';
import { MasonryGrid } from './MasonryGrid';
import { SearchBar } from './SearchBar';
import { AddDock } from './AddDock';
import { FilterPopover, type FilterGroup } from './FilterPopover';
import { AddBookmarkPopover } from '@/components/Pin/AddBookmarkPopover';
import { PinActionMenu } from '@/components/Pin/PinActionMenu';
import { PinDetailPopover } from '@/components/Pin/PinDetailPopover';
import { EditBookmarkPopover } from '@/components/Pin/EditBookmarkPopover';
import { ProfilePopover } from '@/components/Profile/ProfilePopover';
import { UserAvatar } from '@/components/Profile/UserAvatar';
import { usePins } from '@/hooks/usePins';
import { usePinMutations, type EditPinPatch } from '@/hooks/usePinMutations';
import { useSettings } from '@/hooks/useSettings';
import type { BookmarkQuery, BookmarkType, Pin, SortKey } from '@/types/bookmarks';
import { syncNowIfLinked } from '@/utils/igDm';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Overlay = { pin: Pin; mode: 'actions' | 'detail' | 'edit' } | null;

export function HomeScreen() {
  const theme = useTheme() as AppTheme;
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState(settings.defaultStatus || 'all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [active, setActive] = useState<Overlay>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const filtersActive =
    type !== 'all' || status !== 'all' || tagFilter != null || sort !== 'newest';

  const onSelectGroup = useCallback(
    (group: FilterGroup, value: string) => {
      if (group === 'type') {
        if (value === type) return;
        setType(value);
        return;
      }
      if (group === 'status') {
        if (value === status) return;
        setStatus(value);
        return;
      }
      if (value === sort) return;
      setSort(value as SortKey);
    },
    [type, status, sort]
  );

  const clearFilters = useCallback(() => {
    setType('all');
    setStatus('all');
    setTagFilter(null);
  }, []);

  const handleTagFilter = useCallback((tag: string) => {
    setTagFilter(tag);
    setActive(null);
  }, []);

  const query = useMemo<BookmarkQuery>(
    () => ({
      search: deferredSearch,
      archived: status === 'archived' ? true : false,
      type: type === 'all' ? undefined : (type as BookmarkType),
      favorite: status === 'favorites' ? true : undefined,
      unread: status === 'unread' ? true : undefined,
      tag: tagFilter ?? undefined,
      sort: sort === 'newest' ? undefined : sort,
    }),
    [deferredSearch, type, status, tagFilter, sort]
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

  const { toggleFavorite, toggleRead, toggleArchive, deletePin, editPin } = usePinMutations(
    pins,
    setPins,
    query,
    handleMutated
  );

  // Refetch page 0 after a new bookmark is saved from the AddBookmarkPopover.
  const handleSaved = useCallback(() => {
    void refresh();
  }, [refresh]);

  // Pull-to-refresh = grid refresh + a silent Instagram sync in parallel. If
  // the sync inserted new bookmarks, refetch once more so they show up, then
  // toast the count. Errors are swallowed here — it's a background nicety.
  const handleRefresh = useCallback(async () => {
    const [syncResult] = await Promise.all([syncNowIfLinked(), refresh()]);
    if (syncResult && syncResult.inserted > 0) {
      await refresh();
      showToast(
        `Imported ${syncResult.inserted} bookmark${syncResult.inserted === 1 ? '' : 's'} from Instagram.`,
        'success'
      );
    }
  }, [refresh, showToast]);

  const handlePressPin = useCallback((pin: Pin) => setActive({ pin, mode: 'detail' }), []);
  const handleLongPressPin = useCallback((pin: Pin) => setActive({ pin, mode: 'actions' }), []);
  const handlePressMenu = useCallback((pin: Pin) => setActive({ pin, mode: 'actions' }), []);

  const trailing = useMemo(
    () => (
      <View className="ml-1.5 flex-row items-center">
        {filtersActive && (
          <View
            className="mr-1 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: theme.colors.primary }}
          />
        )}
        <Pressable onPress={() => setShowFilters(true)} hitSlop={8}>
          <Ionicons
            name="filter"
            size={16}
            color={filtersActive ? theme.colors.primary : theme.colors.textMuted}
          />
        </Pressable>
      </View>
    ),
    [filtersActive, theme.colors.primary, theme.colors.textMuted]
  );

  const openLink = useCallback(
    (pin: Pin) => {
      if (!pin.isRead) toggleRead(pin);
      Linking.openURL(pin.url).catch(() => {
        showToast('This link could not be opened.', 'error');
      });
    },
    [toggleRead, showToast]
  );

  const copyUrl = useCallback(
    (pin: Pin) => {
      void Clipboard.setStringAsync(pin.url).then(() => {
        showToast('Link copied to clipboard.', 'success');
      });
    },
    [showToast]
  );

  const confirmDelete = useCallback(
    async (pin: Pin) => {
      const ok = await confirm({
        title: 'Delete bookmark',
        message: `"${pin.title}" will be permanently removed.`,
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (ok) deletePin(pin);
    },
    [confirm, deletePin]
  );

  const handleSharePin = useCallback((pin: Pin) => {
    void Share.share({ title: pin.title, message: pin.url });
  }, []);

  const handleEditPin = useCallback((pin: Pin) => setActive({ pin, mode: 'edit' }), []);

  const handleEditSave = useCallback(
    (pin: Pin, patch: EditPinPatch) => {
      editPin(pin, patch);
      setActive(null);
    },
    [editPin]
  );

  const header = useMemo(
    () => (
      <View className="mt-4 px-4 pb-3 pt-4 ">
        <View className="flex-row items-center justify-between ">
          <Text
            className="text-[24px] font-bold tracking-tight"
            style={{ color: theme.colors.text }}>
            Stashly
          </Text>
          <Pressable hitSlop={8} onPress={() => setShowProfile(true)} className="active:opacity-70">
            <UserAvatar
              uri={settings?.avatarUri ?? ''}
              name={settings?.displayName || settings?.username || ''}
              size={28}
            />
          </Pressable>
        </View>

        <View className="mt-2.5">
          <SearchBar value={search} onChangeText={setSearch} trailing={trailing} />
        </View>
      </View>
    ),
    [search, trailing, settings, theme.colors.text]
  );

  const footer = useMemo(
    () => (
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
      </View>
    ),
    [loading, hasMore, pins.length, error, theme.colors.textFaint]
  );

  const empty = useMemo(
    () =>
      !loading && !refreshing && !error ? (
        <Text className="mt-16 text-center text-[12px]" style={{ color: theme.colors.textMuted }}>
          No bookmarks yet.
        </Text>
      ) : null,
    [loading, refreshing, error, theme.colors.textMuted]
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <MasonryGrid
        pins={pins}
        onPressPin={handlePressPin}
        onLongPressPin={handleLongPressPin}
        onPressMenu={handlePressMenu}
        headerContent={header}
        footer={footer}
        empty={empty}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={loadMore}
        bottomPadding={insets.bottom + 96}
      />

      <AddDock onPress={() => setShowAdd(true)} />

      <AddBookmarkPopover
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={handleSaved}
      />

      <FilterPopover
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        type={type}
        status={status}
        sort={sort}
        tag={tagFilter ?? undefined}
        onSelectGroup={onSelectGroup}
        onClearTag={clearFilters}
      />

      <ProfilePopover
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onImported={handleSaved}
      />

      {active?.mode === 'actions' && (
        <PinActionMenu
          pin={active.pin}
          visible
          onClose={() => setActive(null)}
          onOpenLink={() => openLink(active.pin)}
          onViewDetails={() => setActive((prev) => (prev ? { ...prev, mode: 'detail' } : prev))}
          onEdit={() => handleEditPin(active.pin)}
          onToggleFavorite={() => toggleFavorite(active.pin)}
          onToggleRead={() => toggleRead(active.pin)}
          onToggleArchive={() => toggleArchive(active.pin)}
          onCopyUrl={() => copyUrl(active.pin)}
          onShare={() => handleSharePin(active.pin)}
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
          onEdit={() => handleEditPin(active.pin)}
          onShare={() => handleSharePin(active.pin)}
          onTagPress={handleTagFilter}
          onDelete={() => confirmDelete(active.pin)}
        />
      )}

      {active?.mode === 'edit' && (
        <EditBookmarkPopover
          pin={active.pin}
          visible
          onClose={() => setActive(null)}
          onSave={(patch) => handleEditSave(active.pin, patch)}
        />
      )}
    </View>
  );
}
