import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import type { Pin } from '@/types/bookmarks';
import { useTheme } from 'expo-router';
import type { AppTheme } from '@/constants/theme';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';
import { LayoutChangeEvent, RefreshControl, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { imageHeightFor } from '@/utils/pin';
import { PinCard } from './PinCard';

const GRID_EDGE_PADDING = 8; // px-2 per side; inner width = W - 16
const COLUMN_MARGIN = 4; // mx-1 on each side of a card
const COLLAPSE_THRESHOLD = 8; // px of downward scroll before the header hides
const HEADER_SPRING = { damping: 22, stiffness: 220, mass: 0.7 };

type ListExtraComponent = ComponentType | ReactElement | null | undefined;

// Reanimated needs its own wrapped list for `useAnimatedScrollHandler` to
// attach worklet scroll events; props (masonry, numColumns, ...) pass through.
// The cast restores FlashList's generic item typing that createAnimatedComponent erases.
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as typeof FlashList;

// Fixed width breakpoints: phone 2-up, tablet 3-up, large/landscape 4-up.
function columnsForWidth(width: number): number {
  if (width >= 960) return 4;
  if (width >= 600) return 3;
  return 2;
}

// Item-level memo: rebuilds the per-pin callbacks only when that pin or any of
// the stable parent callbacks change, so unchanged cards skip re-rendering.
const MasonryItem = memo(function MasonryItem({
  pin,
  imageHeight,
  onPressPin,
  onLongPressPin,
  onPressMenu,
}: {
  pin: Pin;
  imageHeight: number;
  onPressPin?: (pin: Pin) => void;
  onLongPressPin?: (pin: Pin) => void;
  onPressMenu?: (pin: Pin) => void;
}) {
  const onPress = useCallback(() => onPressPin?.(pin), [onPressPin, pin]);
  const onLongPress = useCallback(() => onLongPressPin?.(pin), [onLongPressPin, pin]);
  const handlePressMenu = useCallback(() => onPressMenu?.(pin), [onPressMenu, pin]);

  return (
    <View style={{ marginHorizontal: COLUMN_MARGIN }}>
      <PinCard
        pin={pin}
        imageHeight={imageHeight}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressMenu={handlePressMenu}
      />
    </View>
  );
});

export const MasonryGrid = memo(function MasonryGrid({
  pins,
  onPressPin,
  onLongPressPin,
  onPressMenu,
  headerContent,
  footer,
  empty,
  refreshing,
  onRefresh,
  onEndReached,
  bottomPadding,
}: {
  pins: Pin[];
  onPressPin?: (pin: Pin) => void;
  onLongPressPin?: (pin: Pin) => void;
  onPressMenu?: (pin: Pin) => void;
  headerContent?: ReactNode;
  footer?: ListExtraComponent;
  empty?: ListExtraComponent;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  bottomPadding: number;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);

  const theme = useTheme() as AppTheme;

  // Shared-value scroll state: 0 = header pinned, 1 = collapsed. Values are
  // reset on remount (keyed by columnCount) so a rotation never shows a hidden
  // header over an empty padded gap.
  const progress = useSharedValue(0);
  const prevScrollY = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      if (y <= 2) {
        progress.value = 0;
        prevScrollY.value = y;
        return;
      }
      const dy = y - prevScrollY.value;
      prevScrollY.value = y;
      if (dy > 0) {
        // Content scrolls up (reading further) -> hide once past the threshold.
        if (y > COLLAPSE_THRESHOLD) progress.value = 1;
      } else if (dy < 0) {
        // Content scrolls down (back toward the top) -> reveal immediately,
        // no need to reach the top.
        progress.value = 0;
      }
    },
  });

  // Hybrid collapse: the header row's height and its contents translate up by
  // the same spring amount, so the header glides away exactly like the old
  // overlay while its row simultaneously shrinks — no backdrop or blank strip
  // is left behind and the list frame expands to fill the vacated space.
  const headerSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(-progress.value * headerHeight, HEADER_SPRING) }],
  }));

  // Height undefined until measured: the first frame lays out naturally at its
  // intrinsic height, and the measured height drives the collapse afterwards.
  const headerCollapseStyle = useAnimatedStyle(() => ({
    height:
      headerHeight === 0
        ? undefined
        : withSpring(headerHeight * (1 - progress.value), HEADER_SPRING),
  }));

  const fallbackWidth = 180;
  const width = containerWidth || fallbackWidth;
  const columnCount = columnsForWidth(width);
  // Card width parity with the previous px-2 + mx-1 layout:
  // (W - 16) / columnCount - 8. FlashList cells span (W - 16) / columnCount
  // because contentContainerStyle applies GRID_EDGE_PADDING on each side.
  const columnWidth =
    (width - GRID_EDGE_PADDING * 2 - COLUMN_MARGIN * columnCount * 2) / columnCount;

  // Hides the header whenever the grid remounts (column/rotation change).
  useEffect(() => {
    progress.value = 0;
  }, [columnCount, progress]);

  const heights = useMemo(() => {
    const map = new Map<number, number>();
    for (const pin of pins) map.set(pin.id, imageHeightFor(pin, columnWidth));
    return map;
  }, [pins, columnWidth]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Pin>) => (
      <MasonryItem
        pin={item}
        imageHeight={heights.get(item.id) ?? 0}
        onPressPin={onPressPin}
        onLongPressPin={onLongPressPin}
        onPressMenu={onPressMenu}
      />
    ),
    [heights, onPressPin, onLongPressPin, onPressMenu]
  );

  const keyExtractor = useCallback((item: Pin) => String(item.id), []);

  return (
    <View className="flex-1" onLayout={onLayout}>
      {/* Header is a real layout row above the list, not an overlay: collapse
          translates its contents up while the row height shrinks in sync, so
          nothing (backdrop/blank strip) is left pinned on top and the list
          frame grows to fill the space. Pull-to-refresh always sits at the
          list's real top. */}
      {headerContent != null && (
        <Animated.View
          style={[{ overflow: 'hidden' }, headerCollapseStyle]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <Animated.View style={headerSlideStyle}>{headerContent}</Animated.View>
        </Animated.View>
      )}

      <AnimatedFlashList
        key={columnCount}
        className="flex-1"
        data={pins}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        masonry
        numColumns={columnCount}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={null}
        ListFooterComponent={footer}
        ListEmptyComponent={empty}
        contentContainerStyle={{
          paddingHorizontal: GRID_EDGE_PADDING,
          paddingBottom: bottomPadding,
        }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={theme.colors.textMuted}
            colors={[theme.colors.textMuted]}
            progressBackgroundColor={theme.colors.card}
          />
        }
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
});
