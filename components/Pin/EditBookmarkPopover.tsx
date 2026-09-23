import { Ionicons } from '@expo/vector-icons';
import { PopupCard } from '@/components/Pin/PopupCard';
import type { AppTheme } from '@/constants/theme';
import type { EditPinPatch } from '@/hooks/usePinMutations';
import type { Pin } from '@/types/bookmarks';
import { normalizeTags } from '@/utils/pin';
import { useTheme } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ColorValue,
} from 'react-native';

function Label({ children, color }: { children: string; color: ColorValue }) {
  return (
    <Text className="mt-3.5 text-[11px] font-semibold" style={{ color }}>
      {children}
    </Text>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  color,
  colors,
  multiline,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  color: ColorValue;
  colors: { surfaceAlt: ColorValue; textMuted: ColorValue; text: ColorValue };
  multiline?: boolean;
}) {
  return (
    <View className="mt-1 rounded-2xl px-3 py-2" style={{ backgroundColor: colors.surfaceAlt }}>
      <TextInput
        className="py-1 text-[13px]"
        style={{
          color,
          minHeight: multiline ? 64 : undefined,
          textAlignVertical: multiline ? 'top' : undefined,
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        autoCorrect={false}
        autoComplete="off"
      />
    </View>
  );
}

export function EditBookmarkPopover({
  pin,
  visible,
  onClose,
  onSave,
}: {
  pin: Pin;
  visible: boolean;
  onClose: () => void;
  onSave: (patch: EditPinPatch) => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;

  const [title, setTitle] = useState(pin.title);
  const [description, setDescription] = useState(pin.description);
  const [tags, setTags] = useState(pin.tags.join(', '));
  const [notes, setNotes] = useState(pin.notes);

  const processedTags = useMemo(() => normalizeTags(tags), [tags]);

  const hasChanges = useMemo(() => {
    return (
      title.trim() !== pin.title ||
      description.trim() !== pin.description ||
      notes.trim() !== pin.notes ||
      normalizeTags(tags).join('\u0000') !== pin.tags.join('\u0000')
    );
  }, [title, description, tags, notes, pin]);

  const save = () => {
    onSave({
      customTitle: title.trim() === pin.autoTitle ? '' : title.trim(),
      customDescription: description.trim() === pin.autoDescription ? '' : description.trim(),
      tags: processedTags,
      notes: notes.trim(),
    });
  };

  return (
    <PopupCard visible={visible} onClose={onClose} maxWidth={340}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center justify-between px-4 pt-3.5">
          <Text className="text-[14px] font-bold" style={{ color: c.text }}>
            Edit bookmark
          </Text>
          <Pressable onPress={onClose} hitSlop={8} className="p-0.5 active:opacity-60">
            <Ionicons name="close" size={18} color={c.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          className="px-4"
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 460, flexShrink: 1 }}>
          <View className="mt-2 flex-row items-center">
            <Ionicons name="link" size={12} color={c.textFaint} />
            <Text
              className="ml-1.5 flex-1 text-[10px]"
              style={{ color: c.textFaint }}
              numberOfLines={1}>
              {pin.url}
            </Text>
          </View>

          <Label color={c.textMuted}>Title</Label>
          <Field
            value={title}
            onChangeText={setTitle}
            placeholder="Leave empty to use the saved title"
            color={c.text}
            colors={c}
          />

          <Label color={c.textMuted}>Description</Label>
          <Field
            value={description}
            onChangeText={setDescription}
            placeholder="Optional short description"
            color={c.text}
            colors={c}
            multiline
          />

          <Label color={c.textMuted}>Tags</Label>
          <Field
            value={tags}
            onChangeText={setTags}
            placeholder="cooking, travel, inspiration"
            color={c.text}
            colors={c}
          />

          <Label color={c.textMuted}>Notes</Label>
          <Field
            value={notes}
            onChangeText={setNotes}
            placeholder="Private notes for later"
            color={c.text}
            colors={c}
            multiline
          />

          <Text className="mt-2 text-[10px]" style={{ color: c.textFaint }}>
            Title and description fall back to the saved ones when left empty.
          </Text>
        </ScrollView>

        <View className="px-4 pb-4 pt-2">
          <Pressable
            onPress={save}
            disabled={!hasChanges}
            className="items-center rounded-2xl py-2.5"
            style={{ backgroundColor: hasChanges ? c.primary : c.surfaceAlt }}>
            <Text
              className="text-[13px] font-bold"
              style={{ color: hasChanges ? '#FFFFFF' : c.textFaint }}>
              Save changes
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </PopupCard>
  );
}
