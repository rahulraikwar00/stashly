import { useState } from 'react';
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

export function MasonryGrid({ pins }: { pins: Pin[] }) {
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const fallbackWidth = 180;
  const width = containerWidth || fallbackWidth;
  const columnCount = columnsForWidth(width);
  const columnWidth = (width - H_PADDING - COLUMN_MARGIN * columnCount * 2) / columnCount;
  const columns = splitIntoColumns(pins, columnCount);

  return (
    <View className="flex-row px-2" onLayout={onLayout}>
      {columns.map((items, index) => (
        <View key={index} className="flex-1" style={{ marginHorizontal: COLUMN_MARGIN }}>
          {items.map((pin) => (
            <PinCard key={pin.id} pin={pin} imageHeight={imageHeightFor(pin, columnWidth)} />
          ))}
        </View>
      ))}
    </View>
  );
}
