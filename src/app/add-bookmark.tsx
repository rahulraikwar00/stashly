import { Ionicons } from '@expo/vector-icons';
import { PinTypePill } from '@/components/Home/PinTypePill';
import type { AppTheme } from '@/constants/theme';
import type { Bookmark, NewBookmark } from '@/db/schema';
import { enrichBookmark, getBookmarkByUrlHash, saveBookmark } from '@/db/bookmarkService';
import { markSavingComplete } from '@/hooks/pendingRefresh';
import { useIncomingShare, type ResolvedSharePayload, type SharePayload } from 'expo-sharing';
import { Stack, useRouter, useTheme } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { bookmarkToPin } from '@/utils/pin';
import { urlHashFor } from '@/utils/hash';
import { faviconForDomain } from '@/utils/metadata';

type Status = 'idle' | 'saving' | 'enriching' | 'done';

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractSharedUrl(shared: SharePayload[], resolved: ResolvedSharePayload[]): string | null {
  const website = resolved.find((p) => p.contentType === 'website' && isHttpUrl(p.contentUri));
  if (website) return website.contentUri;
  const urlPayload = shared.find((p) => p.shareType === 'url' && isHttpUrl(p.value));
  if (urlPayload) return urlPayload.value;
  const textPayload = shared.find((p) => p.shareType === 'text' && isHttpUrl(p.value));
  return textPayload ? textPayload.value.trim() : null;
}

export default function AddBookmarkScreen() {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const router = useRouter();

  const { sharedPayloads, resolvedSharedPayloads, clearSharedPayloads } = useIncomingShare();

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [enrichmentFailed, setEnrichmentFailed] = useState(false);

  const urlRef = useRef('');
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const sharedUrl = useMemo(
    () => extractSharedUrl(sharedPayloads, resolvedSharedPayloads),
    [sharedPayloads, resolvedSharedPayloads]
  );

  useEffect(() => {
    if (sharedUrl && !urlRef.current && status === 'idle') {
      setUrl(sharedUrl);
    }
  }, [sharedUrl, status]);

  const canSave = isHttpUrl(url) && (status === 'idle' || status === 'done');

  const onSave = async () => {
    if (!isHttpUrl(url)) return;
    setStatus('saving');

    const trimmed = url.trim();
    const hash = urlHashFor(trimmed);
    try {
      const existing = await getBookmarkByUrlHash(hash);
      if (existing) {
        clearSharedPayloads();
        setStatus('idle');
        Alert.alert('Already saved', `This link is already in your library.`);
        return;
      }
    } catch {
      setStatus('idle');
      Alert.alert('Something went wrong', 'Could not check this link. Please try again.');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setStatus('idle');
      Alert.alert('Invalid URL', 'Please enter a valid link (starting with http:// or https://).');
      return;
    }

    const domain = parsed.hostname;
    const now = Date.now();
    const row: NewBookmark = {
      url: trimmed,
      urlHash: hash,
      domain,
      path: parsed.pathname,
      title: domain,
      description: '',
      image: '',
      favicon: faviconForDomain(domain),
      siteName: domain,
      author: '',
      publishedAt: null,
      language: '',
      type: 'link',
      tags: '[]',
      notes: '',
      isFavorite: false,
      isArchived: false,
      isRead: false,
      customTitle: '',
      customDescription: '',
      createdAt: now,
      updatedAt: now,
      lastViewedAt: null,
      viewCount: 0,
    };

    let saved: Bookmark;
    try {
      saved = await saveBookmark(row);
    } catch {
      setStatus('idle');
      Alert.alert('Could not save', 'Please try again.');
      return;
    }

    markSavingComplete();
    clearSharedPayloads();
    setBookmark(saved);

    setStatus('enriching');
    const metadata = await enrichBookmark(saved.id, trimmed);
    if (metadata) {
      setBookmark({ ...saved, ...metadata });
    } else {
      setEnrichmentFailed(true);
    }
    setStatus('done');
  };

  const pin = bookmark ? bookmarkToPin(bookmark) : null;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          presentation: 'modal',
          title: 'Save bookmark',
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '600' },
          headerLeft: () =>
            status === 'idle' ? (
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Ionicons name="close" size={22} color={c.text} />
              </Pressable>
            ) : null,
        }}
      />

      <View className="flex-1 px-4 pb-6 pt-4">
        {status === 'idle' && (
          <>
            <Text className="text-[13px] font-semibold" style={{ color: c.text }}>
              {sharedUrl ? 'Paste the link you want to save' : 'Add a link to your library'}
            </Text>
            <Text className="mt-1 text-[11px]" style={{ color: c.textMuted }}>
              Paste any URL — we fetch the title, image and details in the background.
            </Text>

            <View
              className="mt-3 flex-row items-center rounded-2xl px-3.5 py-2"
              style={{ backgroundColor: c.surfaceAlt }}>
              <Ionicons name="link" size={16} color={c.textMuted} />
              <TextInput
                className="ml-2 flex-1 py-1 text-[14px]"
                style={{ color: c.text }}
                placeholder="https://example.com/article"
                placeholderTextColor={c.textMuted}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
              />
              {url.length > 0 && (
                <Pressable onPress={() => setUrl('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={c.textFaint} />
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={onSave}
              disabled={!canSave}
              className="mt-4 items-center rounded-2xl py-3"
              style={{ backgroundColor: canSave ? c.primary : c.surfaceAlt }}>
              <Text
                className="text-[14px] font-bold"
                style={{ color: canSave ? '#FFFFFF' : c.textFaint }}>
                Save bookmark
              </Text>
            </Pressable>
          </>
        )}

        {(status === 'saving' || status === 'enriching') && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={c.primary} />
            <Text className="mt-4 text-[14px] font-semibold" style={{ color: c.text }}>
              {status === 'saving' ? 'Saving…' : 'Fetching details…'}
            </Text>
            <Text className="mt-1 text-center text-[11px]" style={{ color: c.textMuted }}>
              {status === 'enriching'
                ? 'The bookmark is saved. Reading title, image and more from the page.'
                : 'Adding the link to your library.'}
            </Text>
          </View>
        )}

        {status === 'done' && pin && bookmark && (
          <View className="flex-1">
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={28} color={c.primary} />
              <View className="ml-2.5 flex-1">
                <Text className="text-[15px] font-bold" style={{ color: c.text }}>
                  Saved to your library
                </Text>
                <Text className="text-[11px]" style={{ color: c.textMuted }}>
                  {enrichmentFailed
                    ? 'Could not load extra details — saved with the domain only.'
                    : 'Title, image and details loaded automatically.'}
                </Text>
              </View>
            </View>

            <View
              className="mb-2 mt-5 w-full overflow-hidden rounded-2xl"
              style={{ backgroundColor: c.surface }}>
              {pin.image ? (
                <View className="relative">
                  <Image
                    source={{ uri: pin.image }}
                    style={{ width: '100%', height: 180 }}
                    resizeMode="cover"
                  />
                  {pin.type !== 'article' && <PinTypePill type={pin.type} theme={theme} />}
                </View>
              ) : (
                <View className="flex-row items-center px-3 py-4">
                  <Image source={{ uri: pin.favicon }} className="h-4 w-4 rounded-[3px]" />
                  <Text
                    className="ml-2 flex-1 text-[10px]"
                    style={{ color: c.textFaint }}
                    numberOfLines={1}>
                    {pin.source}
                  </Text>
                  <Text
                    className="text-[9px] font-bold tracking-widest"
                    style={{ color: c.textFaint }}>
                    {pin.type.toUpperCase()}
                  </Text>
                </View>
              )}

              <View className="px-3 py-2.5">
                <Text
                  className="text-[13px] font-semibold leading-[17px]"
                  style={{ color: c.text }}
                  numberOfLines={2}>
                  {pin.title}
                </Text>
                {pin.description ? (
                  <Text
                    className="mt-1 text-[11px] leading-[15px]"
                    style={{ color: c.textMuted }}
                    numberOfLines={2}>
                    {pin.description}
                  </Text>
                ) : null}
                <View className="mt-1.5 flex-row items-center">
                  <Image source={{ uri: pin.favicon }} className="h-3 w-3 rounded-[3px]" />
                  <Text
                    className="ml-1.5 text-[10px]"
                    style={{ color: c.textFaint }}
                    numberOfLines={1}>
                    {url}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-1" />

            <Pressable
              onPress={() => router.back()}
              className="items-center rounded-2xl py-3"
              style={{ backgroundColor: c.primary }}>
              <Text className="text-[14px] font-bold" style={{ color: '#FFFFFF' }}>
                Done
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
