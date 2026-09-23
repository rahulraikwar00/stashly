import { Ionicons } from '@expo/vector-icons';
import { PinTypePill } from '@/components/Home/PinTypePill';
import { PopupCard } from '@/components/Pin/PopupCard';
import type { AppTheme } from '@/constants/theme';
import type { Bookmark, NewBookmark } from '@/db/schema';
import {
  enrichBookmark,
  getBookmarkByUrlHash,
  saveBookmark,
  type EnrichmentResult,
} from '@/db/bookmarkService';
import { useIncomingShare, type ResolvedSharePayload, type SharePayload } from 'expo-sharing';
import { useTheme } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useToast } from '@/components/Feedback/ToastProvider';
import { bookmarkToPin, normalizeTags } from '@/utils/pin';
import { faviconForDomain } from '@/utils/metadata';
import { urlHashFor } from '@/utils/hash';

type Status = 'idle' | 'saving' | 'done';

type EnrichTone = 'loading' | 'success' | 'warn' | 'error';
type EnrichStatus = { tone: EnrichTone; text: string } | null;

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function enrichFeedbackFor(result: EnrichmentResult): Exclude<EnrichStatus, null> {
  const time = formatMs(result.durationMs);
  switch (result.source) {
    case 'direct':
      return { tone: 'success', text: `Loaded on-device · ${time}` };
    case 'extractor-self-hosted':
      return { tone: 'success', text: `Loaded via self-hosted extractor · ${time}` };
    case 'extractor-interim':
      return { tone: 'warn', text: `Loaded via interim extractor · ${time}` };
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function nowMs(): number {
  return Date.now();
}

function extractSharedUrl(shared: SharePayload[], resolved: ResolvedSharePayload[]): string | null {
  const website = resolved.find((p) => p.contentType === 'website' && isHttpUrl(p.contentUri));
  if (website) return website.contentUri;
  const urlPayload = shared.find((p) => p.shareType === 'url' && isHttpUrl(p.value));
  if (urlPayload) return urlPayload.value;
  const textPayload = shared.find((p) => p.shareType === 'text' && isHttpUrl(p.value));
  return textPayload ? textPayload.value.trim() : null;
}

export function AddBookmarkPopover({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const { showToast } = useToast();

  const { sharedPayloads, resolvedSharedPayloads, clearSharedPayloads, refreshSharePayloads } =
    useIncomingShare();

  const [url, setUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [enrichStatus, setEnrichStatus] = useState<EnrichStatus>(null);

  const urlRef = useRef('');
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  // Latched once the incoming URL has been consumed into the form, so manual
  // pastes keep the saved-preview screen while share-initiated saves auto-close.
  const fromShareRef = useRef(false);

  // `pendingShareUrl` drives the auto-open. Closing/saving is authoritative and
  // never re-latches the same URL, so a stale `sharedPayloads` (the native
  // clear + hook re-sync can lag or fail on Android) can't re-open the popup
  // the moment the user dismisses it.
  const [pendingShareUrl, setPendingShareUrl] = useState<string | null>(null);
  const lastConsumedRef = useRef<string | null>(null);

  const sharedUrl = useMemo(
    () => extractSharedUrl(sharedPayloads, resolvedSharedPayloads),
    [sharedPayloads, resolvedSharedPayloads]
  );

  useEffect(() => {
    if (
      sharedUrl &&
      sharedUrl !== lastConsumedRef.current &&
      !urlRef.current &&
      status === 'idle'
    ) {
      lastConsumedRef.current = sharedUrl;
      setPendingShareUrl(sharedUrl);
      setUrl(sharedUrl);
      fromShareRef.current = true;
    }
  }, [sharedUrl, status]);

  // A real clear (payloads drain to empty) unblocks a future share of the same
  // URL while the popup stays under `pendingShareUrl` until explicitly closed.
  useEffect(() => {
    if (sharedPayloads.length === 0) {
      lastConsumedRef.current = null;
    }
  }, [sharedPayloads]);

  // Clear the native intent AND re-sync the hook's React state. This is best-
  // effort — closing no longer depends on it — but when the clear does land it
  // drains `sharedPayloads` so the next share is treated as fresh.
  const consumeShared = () => {
    clearSharedPayloads();
    void refreshSharePayloads();
  };

  const resetForm = () => {
    consumeShared();
    fromShareRef.current = false;
    setPendingShareUrl(null);
    setStatus('idle');
    setBookmark(null);
    setEnrichStatus(null);
    setUrl('');
    setTagsInput('');
    urlRef.current = '';
  };

  const dismiss = () => {
    if (status === 'saving') return;
    resetForm();
    onClose?.();
  };

  const canSave = isHttpUrl(url) && (status === 'idle' || status === 'done');

  const onSave = async () => {
    if (!isHttpUrl(url)) return;
    setStatus('saving');

    const trimmed = url.trim();
    const hash = urlHashFor(trimmed);
    try {
      const existing = await getBookmarkByUrlHash(hash);
      if (existing) {
        if (fromShareRef.current) {
          resetForm();
          onClose?.();
        }
        showToast('Already saved — this link is already in your library.', 'info');
        return;
      }
    } catch {
      setStatus('idle');
      showToast('Could not check this link. Please try again.', 'error');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setStatus('idle');
      showToast('Invalid URL — use a link starting with http:// or https://.', 'error');
      return;
    }

    const domain = parsed.hostname;
    const now = nowMs();
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
      tags: JSON.stringify(normalizeTags(tagsInput)),
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
      showToast('Could not save. Please try again.', 'error');
      return;
    }

    if (fromShareRef.current) {
      // Share-initiated save: return to the Library immediately. Enrichment
      // still runs in the background and fires onSaved when metadata lands.
      resetForm();
      onSaved?.();
      void enrichInBackground(saved.id, trimmed);
      onClose?.();
      return;
    }

    setBookmark(saved);
    setStatus('done');
    setEnrichStatus({ tone: 'loading', text: 'Fetching the title and image…' });
    onSaved?.();

    void enrichInBackground(saved.id, trimmed);
  };

  const enrichInBackground = async (id: number, urlToEnrich: string) => {
    try {
      const result = await enrichBookmark(id, urlToEnrich);
      if (result) {
        setBookmark((prev) => (prev && prev.id === id ? { ...prev, ...result.patch } : prev));
        setEnrichStatus(enrichFeedbackFor(result));
        onSaved?.();
      } else {
        setEnrichStatus({
          tone: 'error',
          text: 'No details available — saved with the domain only.',
        });
      }
    } catch {
      setEnrichStatus({
        tone: 'error',
        text: 'No details available — saved with the domain only.',
      });
    }
  };

  const pin = bookmark ? bookmarkToPin(bookmark) : null;

  const ENRICH_DOT_COLORS: Record<EnrichTone, string> = {
    loading: c.textFaint,
    success: '#34D399',
    warn: '#FBBF24',
    error: '#F87171',
  };
  const enrichToneColor = enrichStatus ? ENRICH_DOT_COLORS[enrichStatus.tone] : c.textMuted;
  const enrichText = enrichStatus?.text ?? 'Fetching the title and image…';

  const show = visible || status !== 'idle' || pendingShareUrl != null;

  return (
    <PopupCard visible={show} onClose={dismiss} maxWidth={340}>
      <View className="relative">
        <View className="flex-row items-center justify-between px-4 pt-3.5">
          <Text className="text-[14px] font-bold" style={{ color: c.text }}>
            {status === 'done' ? 'Saved to your library' : 'Add a link'}
          </Text>
          {status !== 'saving' && (
            <Pressable onPress={dismiss} hitSlop={8} className="p-0.5 active:opacity-60">
              <Ionicons name="close" size={18} color={c.textMuted} />
            </Pressable>
          )}
        </View>

        {status === 'idle' && (
          <View className="px-4 pb-4 pt-1">
            <Text className="mt-0.5 text-[11px]" style={{ color: c.textMuted }}>
              Paste any URL — we fetch the title, image and details in the background.
            </Text>

            <View
              className="mt-3 flex-row items-center rounded-2xl px-3 py-2"
              style={{ backgroundColor: c.surfaceAlt }}>
              <Ionicons name="link" size={15} color={c.textMuted} />
              <TextInput
                className="ml-2 flex-1 py-1 text-[13px]"
                style={{ color: c.text }}
                placeholder="https://example.com/article"
                placeholderTextColor={c.textMuted}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={canSave ? onSave : undefined}
              />
              {url.length > 0 && (
                <Pressable onPress={() => setUrl('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={15} color={c.textFaint} />
                </Pressable>
              )}
            </View>

            <Text className="mt-3 text-[11px] font-semibold" style={{ color: c.textMuted }}>
              Tags (optional)
            </Text>
            <View
              className="mt-1 flex-row items-center rounded-2xl px-3 py-2"
              style={{ backgroundColor: c.surfaceAlt }}>
              <Ionicons name="pricetags-outline" size={15} color={c.textMuted} />
              <TextInput
                className="ml-2 flex-1 py-1 text-[13px]"
                style={{ color: c.text }}
                placeholder="cooking, travel, inspiration"
                placeholderTextColor={c.textMuted}
                value={tagsInput}
                onChangeText={setTagsInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Pressable
              onPress={onSave}
              disabled={!canSave}
              className="mt-3 items-center rounded-2xl py-2.5"
              style={{ backgroundColor: canSave ? c.primary : c.surfaceAlt }}>
              <Text
                className="text-[13px] font-bold"
                style={{ color: canSave ? '#FFFFFF' : c.textFaint }}>
                Save bookmark
              </Text>
            </Pressable>
          </View>
        )}

        {status === 'saving' && (
          <View className="items-center justify-center px-4 pb-6 pt-2">
            <ActivityIndicator color={c.primary} />
            <Text className="mt-3 text-[13px] font-semibold" style={{ color: c.text }}>
              Saving…
            </Text>
            <Text className="mt-0.5 text-[11px]" style={{ color: c.textMuted }}>
              Adding the link to your library.
            </Text>
          </View>
        )}

        {status === 'done' && pin && bookmark && (
          <>
            <View className="flex-row items-center px-4 pt-0.5">
              <View
                className="mr-1.5 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: enrichToneColor }}
              />
              <Text className="flex-1 text-[11px]" style={{ color: c.textMuted }} numberOfLines={1}>
                {enrichText}
              </Text>
            </View>

            <ScrollView
              className="px-4"
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={{ maxHeight: 320 }}>
              <View
                className="mt-2 w-full overflow-hidden rounded-2xl"
                style={{ backgroundColor: c.surface }}>
                {pin.image ? (
                  <View className="relative">
                    <Image
                      source={{ uri: pin.image }}
                      style={{ width: '100%', height: 150 }}
                      resizeMode="cover"
                    />
                    {pin.type !== 'article' && <PinTypePill type={pin.type} theme={theme} />}
                  </View>
                ) : (
                  <View className="flex-row items-center px-3 py-3">
                    <Image source={{ uri: pin.favicon }} className="h-4 w-4 rounded-[3px]" />
                    <Text
                      className="ml-2 flex-1 text-[10px]"
                      style={{ color: c.textFaint }}
                      numberOfLines={1}>
                      {pin.source}
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
                      {bookmark.url}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={dismiss}
              className="mx-4 mb-4 mt-2.5 items-center rounded-2xl py-2.5"
              style={{ backgroundColor: c.primary }}>
              <Text className="text-[13px] font-bold" style={{ color: '#FFFFFF' }}>
                Done
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </PopupCard>
  );
}
