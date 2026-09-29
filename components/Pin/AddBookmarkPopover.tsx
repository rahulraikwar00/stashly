import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { PopupCard } from '@/components/Pin/PopupCard';
import type { AppTheme } from '@/constants/theme';
import type { NewBookmark } from '@/db/schema';
import { enrichBookmark, getBookmarkByUrlHash, insertBookmark } from '@/db/bookmarkService';
import { useIncomingShare, type ResolvedSharePayload, type SharePayload } from 'expo-sharing';
import { useTheme } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useToast } from '@/components/Feedback/ToastProvider';
import { normalizeTags } from '@/utils/pin';
import { faviconForDomain, isIncompleteBookmark } from '@/utils/metadata';
import { urlHashFor } from '@/utils/hash';

type Status = 'idle' | 'saving';

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
  const t = theme.typography;
  const { showToast } = useToast();

  const { sharedPayloads, resolvedSharedPayloads, clearSharedPayloads, refreshSharePayloads } =
    useIncomingShare();

  const [url, setUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const urlRef = useRef('');
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const fromShareRef = useRef(false);
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

  // Prefill from clipboard when the add sheet opens (manual FAB path only).
  useEffect(() => {
    if (!visible || fromShareRef.current || pendingShareUrl || urlRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const clip = (await Clipboard.getStringAsync()).trim();
        if (cancelled || !clip || !isHttpUrl(clip) || urlRef.current) return;
        setUrl(clip);
      } catch {
        // clipboard unavailable — leave empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, pendingShareUrl]);

  useEffect(() => {
    if (sharedPayloads.length === 0) {
      lastConsumedRef.current = null;
    }
  }, [sharedPayloads]);

  const consumeShared = () => {
    clearSharedPayloads();
    void refreshSharePayloads();
  };

  const resetForm = () => {
    consumeShared();
    fromShareRef.current = false;
    setPendingShareUrl(null);
    setStatus('idle');
    setUrl('');
    setTagsInput('');
    urlRef.current = '';
  };

  const dismiss = () => {
    if (status === 'saving') return;
    resetForm();
    onClose?.();
  };

  const canSave = isHttpUrl(url) && status === 'idle';

  const onSave = async () => {
    if (!isHttpUrl(url)) return;
    setStatus('saving');

    const trimmed = url.trim();
    const hash = urlHashFor(trimmed);
    try {
      const existing = await getBookmarkByUrlHash(hash);
      if (existing) {
        const incomplete = isIncompleteBookmark(existing);
        resetForm();
        onClose?.();
        if (incomplete) {
          showToast('Already saved — refreshing details…', 'info');
          void enrichBookmark(existing.id, existing.url).then(() => onSaved?.());
        } else {
          showToast('Already saved — this link is already in your library.', 'info');
        }
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

    try {
      const saved = await insertBookmark(row);
      if (!saved) {
        const existing = await getBookmarkByUrlHash(hash);
        resetForm();
        onClose?.();
        if (existing && isIncompleteBookmark(existing)) {
          showToast('Already saved — refreshing details…', 'info');
          void enrichBookmark(existing.id, existing.url).then(() => onSaved?.());
        } else {
          showToast('Already saved — this link is already in your library.', 'info');
        }
        return;
      }

      const savedId = saved.id;
      resetForm();
      onSaved?.();
      onClose?.();
      showToast('Saved to your library.', 'success');
      // #region agent log
      fetch('http://127.0.0.1:7747/ingest/7c723dce-edfb-4530-91f2-8c703d63e5fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b207b'},body:JSON.stringify({sessionId:'1b207b',runId:'pre-fix',hypothesisId:'B',location:'AddBookmarkPopover.tsx:onSave',message:'paste enrich start',data:{savedId,allowInterim:true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      void enrichBookmark(savedId, trimmed).then((result) => {
        // #region agent log
        fetch('http://127.0.0.1:7747/ingest/7c723dce-edfb-4530-91f2-8c703d63e5fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b207b'},body:JSON.stringify({sessionId:'1b207b',runId:'pre-fix',hypothesisId:'B',location:'AddBookmarkPopover.tsx:onSave',message:'paste enrich done',data:{savedId,ok:!!result,source:result?.source??null,hasTitle:!!result?.patch.title,hasImage:!!result?.patch.image},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        onSaved?.();
      });
    } catch {
      setStatus('idle');
      showToast('Could not save. Please try again.', 'error');
    }
  };

  const show = visible || status !== 'idle' || pendingShareUrl != null;

  return (
    <PopupCard visible={show} onClose={dismiss} maxWidth={340}>
      <View className="relative">
        <View className="flex-row items-center justify-between px-4 pt-3.5">
          <Text className="font-bold" style={{ color: c.text, fontSize: t.fontSize.title }}>
            Add a link
          </Text>
          {status !== 'saving' && (
            <Pressable onPress={dismiss} hitSlop={8} className="p-0.5 active:opacity-60">
              <Ionicons name="close" size={18} color={c.textMuted} />
            </Pressable>
          )}
        </View>

        {status === 'idle' && (
          <View className="px-4 pb-4 pt-1">
            <Text className="mt-0.5" style={{ color: c.textMuted, fontSize: t.fontSize.small }}>
              Paste any URL — title and image load in the background.
            </Text>

            <View
              className="mt-3 flex-row items-center rounded-2xl px-3 py-2"
              style={{ backgroundColor: c.surfaceAlt }}>
              <Ionicons name="link" size={15} color={c.textMuted} />
              <TextInput
                className="ml-2 flex-1 py-1"
                style={{ color: c.text, fontSize: t.fontSize.body }}
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

            <Text
              className="mt-3 font-semibold"
              style={{ color: c.textMuted, fontSize: t.fontSize.small }}>
              Tags (optional)
            </Text>
            <View
              className="mt-1 flex-row items-center rounded-2xl px-3 py-2"
              style={{ backgroundColor: c.surfaceAlt }}>
              <Ionicons name="pricetags-outline" size={15} color={c.textMuted} />
              <TextInput
                className="ml-2 flex-1 py-1"
                style={{ color: c.text, fontSize: t.fontSize.body }}
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
                className="font-bold"
                style={{
                  color: canSave ? '#FFFFFF' : c.textFaint,
                  fontSize: t.fontSize.body,
                }}>
                Save bookmark
              </Text>
            </Pressable>
          </View>
        )}

        {status === 'saving' && (
          <View className="items-center justify-center px-4 pb-6 pt-2">
            <ActivityIndicator color={c.primary} />
            <Text
              className="mt-3 font-semibold"
              style={{ color: c.text, fontSize: t.fontSize.body }}>
              Saving…
            </Text>
          </View>
        )}
      </View>
    </PopupCard>
  );
}
