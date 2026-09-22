import { useState } from 'react';
import type { Pin } from '@/types/bookmarks';
import { LayoutChangeEvent, View } from 'react-native';
import { imageHeightFor, splitColumns } from '@/utils/pin';
import { PinCard } from './PinCard';

const H_PADDING = 16; // px-2
const COLUMN_MARGIN = 4; // mx-1 on each side

export function MasonryGrid({ pins }: { pins: Pin[] }) {
  const [columnWidth, setColumnWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = (e.nativeEvent.layout.width - H_PADDING - COLUMN_MARGIN * 4) / 2;
    if (w !== columnWidth) setColumnWidth(w);
  };

  const fallbackWidth = 180;
  const width = columnWidth || fallbackWidth;
  const { left, right } = splitColumns(pins);

  const renderColumn = (items: Pin[]) =>
    items.map((pin) => <PinCard key={pin.id} pin={pin} imageHeight={imageHeightFor(pin, width)} />);

  return (
    <View className="flex-row px-2" onLayout={onLayout}>
      <View className="flex-1" style={{ marginHorizontal: COLUMN_MARGIN }}>
        {renderColumn(left)}
      </View>
      <View className="flex-1" style={{ marginHorizontal: COLUMN_MARGIN }}>
        {renderColumn(right)}
      </View>
    </View>
  );
}
