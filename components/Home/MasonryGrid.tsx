import type { Pin } from '@/types/bookmarks';
import { View } from 'react-native';
import { splitColumns } from '@/utils/pin';
import { PinCard } from './PinCard';

export function MasonryGrid({ pins }: { pins: Pin[] }) {
  const { left, right } = splitColumns(pins);

  return (
    <View className="flex-row px-2">
      <View className="flex-1 pr-1">
        {left.map((pin) => (
          <PinCard key={pin.id} pin={pin} />
        ))}
      </View>
      <View className="flex-1 pl-1">
        {right.map((pin) => (
          <PinCard key={pin.id} pin={pin} />
        ))}
      </View>
    </View>
  );
}
