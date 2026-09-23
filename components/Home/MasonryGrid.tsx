import { memo, useCallback, useMemo, useState } from 'react';
import type { Pin } from '@/types/bookmarks';
import { LayoutChangeEvent, View } from 'react-native';
import { imageHeightFor, splitIntoColumns } from '@/utils/pin';
import { PinCard } from './PinCard';

const H_PADDING = 16; // px-2
const COLUMN_MARGIN = 4; // mx-1 on each side

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
    <PinCard
      pin={pin}
      imageHeight={imageHeight}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressMenu={handlePressMenu}
    />
  );
});

export const MasonryGrid = memo(function MasonryGrid({
  pins,
  onPressPin,
  onLongPressPin,
  onPressMenu,
}: {
  pins: Pin[];
  onPressPin?: (pin: Pin) => void;
  onLongPressPin?: (pin: Pin) => void;
  onPressMenu?: (pin: Pin) => void;
}) {
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const fallbackWidth = 180;
  const width = containerWidth || fallbackWidth;
  const columnCount = columnsForWidth(width);
  const columnWidth = (width - H_PADDING - COLUMN_MARGIN * columnCount * 2) / columnCount;

  const columns = useMemo(() => splitIntoColumns(pins, columnCount), [pins, columnCount]);
  const heights = useMemo(() => {
    const map = new Map<number, number>();
    for (const pin of pins) map.set(pin.id, imageHeightFor(pin, columnWidth));
    return map;
  }, [pins, columnWidth]);

  return (
    <View className="flex-row px-2" onLayout={onLayout}>
      {columns.map((items, index) => (
        <View key={index} className="flex-1" style={{ marginHorizontal: COLUMN_MARGIN }}>
          {items.map((pin) => (
            <MasonryItem
              key={pin.id}
              pin={pin}
              imageHeight={heights.get(pin.id) ?? 0}
              onPressPin={onPressPin}
              onLongPressPin={onLongPressPin}
              onPressMenu={onPressMenu}
            />
          ))}
        </View>
      ))}
    </View>
  );
});
