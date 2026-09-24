import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { UserAvatar } from '@/components/Profile/UserAvatar';
import { PopupCard } from '@/components/Pin/PopupCard';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useToast } from '@/components/Feedback/ToastProvider';
import { useConfirm } from '@/components/Feedback/ConfirmProvider';
import { useSettings } from '@/hooks/useSettings';
import type { SettingsPatch } from '@/db/settingsService';
import { importBookmarksJson, shareBookmarksExport } from '@/db/backup';
import { resolveBackendConfig, checkServerHealth, type ServerStatus } from '@/utils/backendConfig';
import {
  IG_HANDLE,
  IGSyncError,
  generateAndRegisterCode,
  getCodeStatus,
  syncNow,
  unlinkCode,
  type RegisterResult,
} from '@/utils/igDm';
import {
  DEFAULT_STATUS_CHOICES,
  THEME_CHOICES,
  persistAvatarUri,
  validateProfile,
  type DefaultStatusChoice,
  type ProfileErrors,
  type ThemeChoice,
} from '@/utils/profile';

type FormFields = {
  displayName: string;
  username: string;
  email: string;
  avatarUri: string;
  serverUrl: string;
  apiKey: string;
};

const STATUS_LABELS: Record<DefaultStatusChoice, string> = {
  all: 'All',
  favorites: 'Favorites',
  unread: 'Unread',
  archived: 'Archived',
};

const THEME_LABELS: Record<ThemeChoice, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

function FormLabel({ children, color }: { children: string; color: string }) {
  return (
    <Text className="mt-3 text-[11px] font-semibold" style={{ color }}>
      {children}
    </Text>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text className="mt-0.5 text-[10px]" style={{ color: '#F87171' }}>
      {message}
    </Text>
  );
}

function countdownLabel(expiresAt: number): string {
  if (!expiresAt) return '';
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Code expired — generate a new one.';
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `Code valid for ${m}m ${s.toString().padStart(2, '0')}s`;
}

function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  labels,
  theme,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
  theme: AppTheme;
}) {
  const c = theme.colors;
  return (
    <View className="mt-1.5 flex-row flex-wrap">
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            className="mb-1.5 mr-2 rounded-full px-3 py-1.5"
            style={{ backgroundColor: selected ? c.primary : c.surfaceAlt }}>
            <Text
              className="text-[12px] font-semibold"
              style={{ color: selected ? '#FFFFFF' : c.textMuted }}>
              {labels[opt]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProfilePopover({
  visible,
  onClose,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  onImported?: () => void;
}) {
  const theme = useTheme() as AppTheme;
  const c = theme.colors;
  const { settings, update } = useSettings();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [form, setForm] = useState<FormFields>(() => ({
    displayName: settings.displayName ?? '',
    username: settings.username ?? '',
    email: settings.email ?? '',
    avatarUri: settings.avatarUri ?? '',
    serverUrl: settings.serverUrl ?? '',
    apiKey: settings.apiKey ?? '',
  }));
  const [pref, setPref] = useState<{ theme: ThemeChoice; defaultStatus: DefaultStatusChoice }>(
    () => ({
      theme: settings.theme as ThemeChoice,
      defaultStatus: settings.defaultStatus as DefaultStatusChoice,
    })
  );
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Instagram sync state machine ────────────────────────────────────
  // 'idle' | 'waiting' (code registered, awaiting /link) | 'linked' |
  // 'unknown' (expired/never registered) | 'error'
  const [showSync, setShowSync] = useState(false);
  const [localCode, setLocalCode] = useState('');
  const [syncPhase, setSyncPhase] = useState<'idle' | 'waiting' | 'linked' | 'unknown' | 'error'>(
    'idle'
  );
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [linkedUsername, setLinkedUsername] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [syncChecking, setSyncChecking] = useState(false);
  const checkBusyRef = useRef(false);

  const code = settings.igCode?.trim() ?? '';

  const runCheckStatus = useCallback(async (codeToCheck: string) => {
    if (checkBusyRef.current) return;
    checkBusyRef.current = true;
    setSyncChecking(true);
    try {
      const config = await resolveBackendConfig();
      if (!config) {
        setSyncPhase('error');
        setSyncError('Server not reachable — set a Self-hosted server URL first.');
        return;
      }
      const st = await getCodeStatus(config.baseUrl, codeToCheck);
      if (st === null) {
        setSyncPhase('unknown');
        return;
      }
      if (st.linked) {
        setSyncPhase('linked');
        setLinkedUsername(st.username);
        return;
      }
      if (st.status === 'expired') {
        setSyncPhase('unknown');
        return;
      }
      setSyncPhase('waiting');
      if (st.expiresAt) setExpiresAt(st.expiresAt);
    } catch (err) {
      setSyncPhase('error');
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncChecking(false);
      checkBusyRef.current = false;
    }
  }, []);

  const onRetryCheck = useCallback(() => {
    if (!code) {
      setSyncPhase('idle');
      return;
    }
    void runCheckStatus(code);
  }, [code, runCheckStatus]);

  // Re-evaluate the connection every time the group opens or the code changes.
  useEffect(() => {
    if (!visible || !showSync || !code) return;
    const t = setTimeout(() => {
      void runCheckStatus(code);
    }, 0);
    return () => clearTimeout(t);
  }, [visible, showSync, code, runCheckStatus]);

  // While waiting for the user to DM /link <code>, poll ~5s until linked/expired.
  useEffect(() => {
    if (!visible || !showSync || syncPhase !== 'waiting') return;
    const timer = setInterval(() => {
      void runCheckStatus(code);
    }, 5000);
    return () => clearInterval(timer);
  }, [visible, showSync, syncPhase, code, runCheckStatus]);

  // ── Server reachability indicator ──────────────────────────────────
  // Pings the configured backend's /health when the popover opens (and after
  // the user saves a new Server URL / API key). On-demand only — no polling.
  const [serverStatus, setServerStatus] = useState<ServerStatus>('unset');
  const serverCheckRef = useRef(false);

  const runServerCheck = useCallback(async () => {
    if (serverCheckRef.current) return;
    serverCheckRef.current = true;
    setServerStatus('checking');
    try {
      setServerStatus(await checkServerHealth());
    } finally {
      serverCheckRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      void runServerCheck();
    }, 0);
    return () => clearTimeout(t);
  }, [visible, settings.serverUrl, settings.apiKey, runServerCheck]);

  const serverLabel: Record<ServerStatus, string> = {
    online: 'Server online',
    offline: 'Server unreachable',
    unset: 'Server not set',
    checking: 'Checking…',
  };

  const serverDotColor: Record<ServerStatus, string> = {
    online: '#22C55E',
    offline: '#EF4444',
    unset: '#9CA3AF',
    checking: '#F59E0B',
  };

  const onConnect = useCallback(async () => {
    if (syncBusy) return;
    const config = await resolveBackendConfig();
    if (!config) {
      showToast('Set your server URL in Self-hosted server first.', 'error');
      return;
    }
    setSyncBusy(true);
    setSyncError('');
    try {
      let registered: RegisterResult;
      for (let attempt = 0; ; attempt += 1) {
        try {
          registered = await generateAndRegisterCode(config.baseUrl);
          break;
        } catch (err) {
          if (err instanceof IGSyncError && err.kind === 'conflict' && attempt < 4) continue;
          throw err;
        }
      }
      await update({ igCode: registered.code });
      setLocalCode(registered.code);
      if (registered.expiresAt) setExpiresAt(registered.expiresAt);
      setSyncPhase('waiting');
    } catch (err) {
      setSyncPhase('error');
      setSyncError(err instanceof Error ? err.message : String(err));
      showToast(err instanceof Error ? err.message : 'Could not start linking.', 'error');
    } finally {
      setSyncBusy(false);
    }
  }, [syncBusy, update, showToast]);

  const onSyncNow = useCallback(async () => {
    if (syncBusy || !code) return;
    const config = await resolveBackendConfig();
    if (!config) {
      showToast('Set your server URL in Self-hosted server first.', 'error');
      return;
    }
    setSyncBusy(true);
    try {
      const result = await syncNow(config.baseUrl, code);
      if (result === null) {
        showToast('Sync already running — give it a moment.', 'info');
        return;
      }
      const message =
        result.inserted > 0
          ? `Imported ${result.inserted} bookmark${result.inserted === 1 ? '' : 's'}${
              result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ''
            }.`
          : 'Nothing new to sync.';
      showToast(message, result.inserted > 0 ? 'success' : 'info');
      if (result.inserted > 0) onImported?.();
    } catch (err) {
      const msg =
        err instanceof IGSyncError && err.kind === 'not-linked'
          ? 'Not linked yet — send /link <code> to the account first.'
          : err instanceof Error
            ? err.message
            : 'Could not sync.';
      showToast(msg, 'error');
    } finally {
      setSyncBusy(false);
    }
  }, [syncBusy, code, showToast, onImported]);

  const onForget = useCallback(async () => {
    setSyncBusy(true);
    let revoked = true;
    try {
      const config = await resolveBackendConfig();
      if (config && code) {
        try {
          await unlinkCode(config.baseUrl, code);
        } catch {
          revoked = false;
        }
      }
      await update({ igCode: '' });
      setLocalCode('');
      setLinkedUsername('');
      setExpiresAt(0);
      setSyncPhase('idle');
      showToast(
        revoked
          ? 'Connection removed.'
          : 'Removed on this device — the server binding could not be revoked.',
        'info'
      );
    } catch {
      showToast('Could not remove the connection.', 'error');
    } finally {
      setSyncBusy(false);
    }
  }, [code, update, showToast]);

  // ── Waiting-phase helpers: copy the code / full message, open the DM ──

  const onOpenDm = useCallback(async () => {
    const target = `/link ${code || localCode}`;
    try {
      await Clipboard.setStringAsync(target);
      showToast('Message copied — paste it in the chat.', 'info');
    } catch {
      // clipboard failure shouldn't block opening the DM
    }
    try {
      await Linking.openURL(`https://ig.me/m/${IG_HANDLE}`);
    } catch {
      showToast('Could not open Instagram.', 'error');
    }
  }, [code, localCode, showToast]);

  const onCopyCode = useCallback(async () => {
    const target = code || localCode;
    if (!target) return;
    try {
      await Clipboard.setStringAsync(target);
      showToast('Code copied.', 'info');
    } catch {
      showToast('Could not copy the code.', 'error');
    }
  }, [code, localCode, showToast]);

  const onCopyFull = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(`/link ${code || localCode}`);
      showToast('/link message copied.', 'info');
    } catch {
      showToast('Could not copy the message.', 'error');
    }
  }, [code, localCode, showToast]);

  const setField = (field: keyof FormFields, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const displayName = form.displayName.trim();
  const avatarName = displayName || form.username.trim() || '';

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = await persistAvatarUri(result.assets[0].uri);
    setForm((f) => ({ ...f, avatarUri: uri }));
  };

  const onSave = async () => {
    const validation = validateProfile({
      displayName: form.displayName,
      username: form.username,
      email: form.email,
      avatarUri: form.avatarUri,
      serverUrl: form.serverUrl,
      apiKey: form.apiKey,
    });
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setSaving(true);
    try {
      const patch: SettingsPatch = {
        displayName: form.displayName.trim(),
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        avatarUri: form.avatarUri.trim(),
        serverUrl: form.serverUrl.trim().replace(/\/+$/, ''),
        apiKey: form.apiKey.trim(),
        theme: pref.theme,
        defaultStatus: pref.defaultStatus,
      };
      await update(patch);
      onClose();
    } catch {
      showToast('Could not save. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    const ok = await confirm({
      title: 'Reset profile',
      message: 'Name, username, email and avatar will be cleared.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!ok) return;
    setForm((f) => ({ ...f, displayName: '', username: '', email: '', avatarUri: '' }));
    setErrors({});
  };

  const onExport = async () => {
    setBackupBusy(true);
    try {
      const result = await shareBookmarksExport();
      if (!result) {
        showToast('Sharing is not available on this device.', 'error');
      } else {
        showToast(`Exported ${result.count} bookmark${result.count === 1 ? '' : 's'}.`, 'success');
      }
    } catch {
      showToast('Could not export. Please try again.', 'error');
    } finally {
      setBackupBusy(false);
    }
  };

  const onImport = async () => {
    if (!backupText.trim() || backupBusy) return;
    const ok = await confirm({
      title: 'Import backup',
      message: 'New bookmarks will be added. Links you already have are kept.',
      confirmLabel: 'Import',
    });
    if (!ok) return;
    setBackupBusy(true);
    try {
      const result = await importBookmarksJson(backupText);
      setBackupText('');
      const summary =
        result.skipped > 0
          ? `${result.imported} imported, ${result.skipped} skipped as duplicates.`
          : `Imported ${result.imported} bookmark${result.imported === 1 ? '' : 's'}.`;
      showToast(summary, 'success');
      onImported?.();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not import. Check the JSON file.',
        'error'
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    return (
      form.displayName !== (settings.displayName ?? '') ||
      form.username !== (settings.username ?? '') ||
      form.email !== (settings.email ?? '') ||
      form.avatarUri !== (settings.avatarUri ?? '') ||
      form.serverUrl !== (settings.serverUrl ?? '') ||
      form.apiKey !== (settings.apiKey ?? '') ||
      pref.theme !== (settings.theme as ThemeChoice) ||
      pref.defaultStatus !== (settings.defaultStatus as DefaultStatusChoice)
    );
  }, [form, pref, settings]);

  const inputRow = (
    field: keyof FormFields,
    opts: {
      placeholder: string;
      keyboardType?: 'email-address' | 'url' | 'default';
      autoCapitalize?: 'none' | 'words' | 'sentences';
      autoCorrect?: boolean;
      secure?: boolean;
      showClear?: boolean;
    }
  ) => {
    const { secure, showClear, ...inputProps } = opts;
    return (
      <View key={field}>
        <View
          className="mt-1 flex-row items-center rounded-2xl px-3 py-2"
          style={{ backgroundColor: c.surfaceAlt }}>
          <TextInput
            className="flex-1 py-1 text-[13px]"
            style={{ color: c.text }}
            placeholder={opts.placeholder}
            placeholderTextColor={c.textMuted}
            value={form[field]}
            onChangeText={(text) => setField(field, text)}
            keyboardType={inputProps.keyboardType}
            autoCapitalize={inputProps.autoCapitalize}
            autoCorrect={inputProps.autoCorrect}
            secureTextEntry={secure}
            autoComplete="off"
          />
          {secure && (
            <Pressable onPress={() => setApiKeyVisible((v) => !v)} hitSlop={8}>
              <Ionicons
                name={apiKeyVisible ? 'eye-off-outline' : 'eye-outline'}
                size={15}
                color={c.textFaint}
              />
            </Pressable>
          )}
          {showClear && form[field].length > 0 && (
            <Pressable onPress={() => setField(field, '')} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={c.textFaint} />
            </Pressable>
          )}
        </View>
        <FieldError message={errors[field]} />
      </View>
    );
  };

  return (
    <PopupCard visible={visible} onClose={onClose} maxWidth={340}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center justify-between px-4 pt-3.5">
          <Text className="text-[14px] font-bold" style={{ color: c.text }}>
            Profile & settings
          </Text>
          {!saving && (
            <Pressable onPress={onClose} hitSlop={8} className="p-0.5 active:opacity-60">
              <Ionicons name="close" size={18} color={c.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          className="px-4"
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 480, flexShrink: 1 }}>
          {/* ‒ Avatar ‒ */}
          <View className="mt-3 items-center">
            <View>
              <UserAvatar uri={form.avatarUri} name={avatarName} size={72} />
              <Pressable
                onPress={pickAvatar}
                hitSlop={8}
                className="absolute -bottom-1 -right-1 items-center justify-center rounded-full p-1.5"
                style={{ backgroundColor: c.primary }}>
                <Ionicons name="camera" size={13} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text className="mt-2 text-[13px] font-semibold" style={{ color: c.text }}>
              {avatarName || 'Your name'}
            </Text>
            {form.email.trim() ? (
              <Text className="text-[11px]" style={{ color: c.textMuted }}>
                {form.email.trim()}
              </Text>
            ) : null}
          </View>

          {/* ‒ Identity ‒ */}
          <FormLabel color={c.textMuted}>Display name</FormLabel>
          {inputRow('displayName', {
            placeholder: 'How should we call you?',
            autoCapitalize: 'words',
            autoCorrect: false,
            showClear: true,
          })}
          <FormLabel color={c.textMuted}>Username</FormLabel>
          {inputRow('username', {
            placeholder: 'username (lowercase, optional)',
            autoCapitalize: 'none',
            autoCorrect: false,
            showClear: true,
          })}
          <FormLabel color={c.textMuted}>Email</FormLabel>
          {inputRow('email', {
            placeholder: 'you@example.com (optional)',
            keyboardType: 'email-address',
            autoCapitalize: 'none',
            autoCorrect: false,
            showClear: true,
          })}

          {/* ‒ Preferences ‒ */}
          <FormLabel color={c.textMuted}>Theme</FormLabel>
          <ChoiceChips
            options={THEME_CHOICES}
            value={pref.theme}
            onChange={(t) => setPref((p) => ({ ...p, theme: t }))}
            labels={THEME_LABELS}
            theme={theme}
          />
          <FormLabel color={c.textMuted}>Default view</FormLabel>
          <ChoiceChips
            options={DEFAULT_STATUS_CHOICES}
            value={pref.defaultStatus}
            onChange={(s) => setPref((p) => ({ ...p, defaultStatus: s }))}
            labels={STATUS_LABELS}
            theme={theme}
          />

          {/* ‒ Server (advanced) ‒ */}
          <Pressable
            onPress={() => setShowServer((s) => !s)}
            className="mt-4 flex-row items-center justify-between rounded-2xl px-3 py-2.5"
            style={{ backgroundColor: c.surfaceAlt }}>
            <View className="flex-row items-center">
              <View
                className="mr-1.5 h-2 w-2 rounded-full"
                style={{ backgroundColor: serverDotColor[serverStatus] }}
              />
              <Text className="text-[12px] font-semibold" style={{ color: c.text }}>
                Self-hosted server
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="mr-2 text-[10px]" style={{ color: c.textMuted }}>
                {serverLabel[serverStatus]}
              </Text>
              <Ionicons
                name={showServer ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={c.textMuted}
              />
            </View>
          </Pressable>
          {showServer && (
            <>
              <Text
                className="mt-2 text-[10px] leading-[14px]"
                style={{ color: serverDotColor[serverStatus] }}>
                {serverStatus === 'online'
                  ? 'Server is reachable — link enrichment and Instagram sync will use it.'
                  : serverStatus === 'offline'
                    ? 'Server is unreachable from this device. Check the URL below and that it is running.'
                    : serverStatus === 'checking'
                      ? 'Checking connection…'
                      : 'No server configured yet — link enrichment falls back to a public API.'}
              </Text>
              <Pressable
                onPress={() => void runServerCheck()}
                disabled={serverStatus === 'checking'}
                className="mt-1 flex-row items-center self-start rounded-full px-3 py-1.5"
                style={{ backgroundColor: c.surfaceAlt }}>
                <Ionicons
                  name="refresh"
                  size={12}
                  color={serverStatus === 'checking' ? c.textMuted : c.primary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: serverStatus === 'checking' ? c.textMuted : c.primary }}>
                  {serverStatus === 'checking' ? 'Checking…' : 'Check now'}
                </Text>
              </Pressable>
              <FormLabel color={c.textMuted}>Server URL</FormLabel>
              {inputRow('serverUrl', {
                placeholder: 'https://api.example.com',
                keyboardType: 'url',
                autoCapitalize: 'none',
                autoCorrect: false,
              })}
              <FormLabel color={c.textMuted}>API key</FormLabel>
              {inputRow('apiKey', {
                placeholder: 'Optional access key',
                autoCapitalize: 'none',
                autoCorrect: false,
                secure: !apiKeyVisible,
              })}
            </>
          )}

          {/* ‒ Instagram sync ‒ */}
          <Pressable
            onPress={() => setShowSync((s) => !s)}
            className="mt-4 flex-row items-center justify-between rounded-2xl px-3 py-2.5"
            style={{ backgroundColor: c.surfaceAlt }}>
            <Text className="text-[12px] font-semibold" style={{ color: c.text }}>
              Instagram sync
            </Text>
            <Ionicons
              name={showSync ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={c.textMuted}
            />
          </Pressable>
          {showSync && (
            <>
              <Text className="mt-0.5 text-[10px] leading-[14px]" style={{ color: c.textFaint }}>
                Link your Instagram to this device: DM a link code to @{IG_HANDLE} and bookmarks
                arrive on pull-to-refresh.
              </Text>

              {syncPhase === 'idle' && (
                <>
                  <Pressable
                    onPress={onConnect}
                    disabled={syncBusy}
                    className="mt-2 items-center rounded-2xl py-2.5"
                    style={{ backgroundColor: syncBusy ? c.surfaceAlt : c.primary }}>
                    {syncBusy ? (
                      <ActivityIndicator size="small" color={c.primary} />
                    ) : (
                      <Text className="text-[12px] font-semibold" style={{ color: '#FFFFFF' }}>
                        Connect Instagram
                      </Text>
                    )}
                  </Pressable>
                </>
              )}

              {syncPhase === 'waiting' && (
                <>
                  <Text className="mt-2 text-[11px] font-semibold" style={{ color: c.text }}>
                    DM this code to @{IG_HANDLE}
                  </Text>
                  <Text
                    className="mt-1 text-center text-[28px] font-bold"
                    style={{ color: c.primary, letterSpacing: 8 }}>
                    {code || localCode}
                  </Text>
                  <Pressable
                    onPress={onOpenDm}
                    className="mt-2 flex-row items-center justify-center rounded-2xl py-2.5"
                    style={{ backgroundColor: c.primary }}>
                    <Ionicons
                      name="paper-plane-outline"
                      size={15}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-[12px] font-semibold" style={{ color: '#FFFFFF' }}>
                      Open Instagram DM
                    </Text>
                  </Pressable>
                  <View className="mt-2 flex-row">
                    <Pressable
                      onPress={onCopyFull}
                      className="flex-1 flex-row items-center justify-center rounded-xl py-2"
                      style={{ backgroundColor: c.surfaceAlt }}>
                      <Ionicons
                        name="copy-outline"
                        size={13}
                        color={c.textMuted}
                        style={{ marginRight: 6 }}
                      />
                      <Text className="text-[11px] font-semibold" style={{ color: c.textMuted }}>
                        Copy /link message
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={onCopyCode}
                      className="ml-2 flex-1 flex-row items-center justify-center rounded-xl py-2"
                      style={{ backgroundColor: c.surfaceAlt }}>
                      <Ionicons
                        name="clipboard-outline"
                        size={13}
                        color={c.textMuted}
                        style={{ marginRight: 6 }}
                      />
                      <Text className="text-[11px] font-semibold" style={{ color: c.textMuted }}>
                        Copy code
                      </Text>
                    </Pressable>
                  </View>
                  <Text className="mt-1 text-[10px] leading-[14px]" style={{ color: c.textFaint }}>
                    The message is copied — open the chat above and hit send (from the account to
                    link, not this one).
                  </Text>
                  <Text
                    className="mt-0.5 text-[10px] leading-[14px]"
                    style={{ color: c.textFaint }}>
                    It auto-syncs here once received (~20s, or pull to refresh after the toast).
                  </Text>
                  <Text className="mt-1 text-[11px] font-semibold" style={{ color: c.textMuted }}>
                    {countdownLabel(expiresAt)}
                  </Text>
                  <Pressable
                    onPress={onConnect}
                    disabled={syncBusy}
                    className="mt-2 items-center rounded-2xl py-2.5"
                    style={{ backgroundColor: syncBusy ? c.surfaceAlt : c.surfaceAlt }}>
                    {syncBusy ? (
                      <ActivityIndicator size="small" color={c.primary} />
                    ) : (
                      <Text className="text-[11px] font-semibold" style={{ color: c.textMuted }}>
                        Use a new code
                      </Text>
                    )}
                  </Pressable>
                </>
              )}

              {syncPhase === 'linked' && (
                <>
                  <View className="mt-2 flex-row items-center">
                    <View
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: '#22C55E' }}
                    />
                    <Text className="text-[12px] font-semibold" style={{ color: c.text }}>
                      Linked to{linkedUsername ? ` @${linkedUsername}` : ' your account'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={onSyncNow}
                    disabled={syncBusy}
                    className="mt-2 flex-row items-center justify-center rounded-2xl py-2.5"
                    style={{ backgroundColor: syncBusy ? c.surfaceAlt : c.primary }}>
                    {syncBusy ? (
                      <ActivityIndicator size="small" color={c.primary} />
                    ) : (
                      <>
                        <Ionicons
                          name="sync-outline"
                          size={15}
                          color="#FFFFFF"
                          style={{ marginRight: 6 }}
                        />
                        <Text className="text-[12px] font-semibold" style={{ color: '#FFFFFF' }}>
                          Sync now
                        </Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable onPress={onForget} disabled={syncBusy} className="mt-1.5 py-1">
                    <Text
                      className="text-center text-[11px] font-semibold"
                      style={{ color: '#F87171' }}>
                      Forget connection
                    </Text>
                  </Pressable>
                </>
              )}

              {syncPhase === 'unknown' && (
                <>
                  <Text className="mt-2 text-[10px] leading-[14px]" style={{ color: c.textFaint }}>
                    This code was never registered, or it expired (10 min TTL). Generate a fresh
                    one.
                  </Text>
                  <Pressable
                    onPress={onConnect}
                    disabled={syncBusy}
                    className="mt-2 items-center rounded-2xl py-2.5"
                    style={{ backgroundColor: syncBusy ? c.surfaceAlt : c.primary }}>
                    {syncBusy ? (
                      <ActivityIndicator size="small" color={c.primary} />
                    ) : (
                      <Text className="text-[12px] font-semibold" style={{ color: '#FFFFFF' }}>
                        Generate a new code
                      </Text>
                    )}
                  </Pressable>
                </>
              )}

              {syncPhase === 'error' && (
                <>
                  <Text className="mt-2 text-[10px] leading-[14px]" style={{ color: '#F87171' }}>
                    {syncError || 'Could not reach your server.'}
                  </Text>
                  <Pressable
                    onPress={onRetryCheck}
                    disabled={syncChecking}
                    className="mt-2 flex-row items-center justify-center rounded-2xl py-2.5"
                    style={{ backgroundColor: c.surfaceAlt }}>
                    {syncChecking ? (
                      <ActivityIndicator size="small" color={c.primary} />
                    ) : (
                      <Text className="text-[11px] font-semibold" style={{ color: c.textMuted }}>
                        Retry
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </>
          )}

          {/* ‒ Backup ‒ */}
          <Pressable
            onPress={() => setShowBackup((s) => !s)}
            className="mt-4 flex-row items-center justify-between rounded-2xl px-3 py-2.5"
            style={{ backgroundColor: c.surfaceAlt }}>
            <Text className="text-[12px] font-semibold" style={{ color: c.text }}>
              Backup library
            </Text>
            <Ionicons
              name={showBackup ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={c.textMuted}
            />
          </Pressable>
          {showBackup && (
            <>
              <Text className="mt-0.5 text-[10px] leading-[14px]" style={{ color: c.textFaint }}>
                Export every bookmark to a JSON file, or restore from one by pasting it below.
              </Text>
              <Pressable
                onPress={onExport}
                disabled={backupBusy}
                className="mt-2 flex-row items-center justify-center rounded-2xl py-2.5"
                style={{ backgroundColor: backupBusy ? c.surfaceAlt : c.surfaceAlt }}>
                {backupBusy ? (
                  <ActivityIndicator size="small" color={c.primary} />
                ) : (
                  <>
                    <Ionicons
                      name="download-outline"
                      size={15}
                      color={c.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-[12px] font-semibold" style={{ color: c.primary }}>
                      Export bookmarks (.json)
                    </Text>
                  </>
                )}
              </Pressable>
              <TextInput
                className="mt-2 rounded-2xl px-3 py-2 text-[11px]"
                style={{
                  backgroundColor: c.surfaceAlt,
                  color: c.text,
                  minHeight: 72,
                  textAlignVertical: 'top',
                }}
                placeholder="Paste exported JSON here to restore…"
                placeholderTextColor={c.textMuted}
                value={backupText}
                onChangeText={setBackupText}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={onImport}
                disabled={!backupText.trim() || backupBusy}
                className="mt-2 items-center rounded-2xl py-2.5"
                style={{
                  backgroundColor: !backupText.trim() || backupBusy ? c.surfaceAlt : c.primary,
                }}>
                <Text
                  className="text-[12px] font-bold"
                  style={{
                    color: !backupText.trim() || backupBusy ? c.textFaint : '#FFFFFF',
                  }}>
                  Import bookmarks
                </Text>
              </Pressable>
            </>
          )}

          <Text className="mt-2 text-[10px]" style={{ color: c.textFaint }}>
            Emails, keys and server address stay on this device only.
          </Text>
        </ScrollView>

        {/* ‒ Actions ‒ */}
        <View className="px-4 pb-4 pt-2">
          <Pressable
            onPress={onSave}
            disabled={saving || !hasChanges}
            className="items-center rounded-2xl py-2.5"
            style={{ backgroundColor: saving || !hasChanges ? c.surfaceAlt : c.primary }}>
            {saving ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <Text
                className="text-[13px] font-bold"
                style={{ color: saving || !hasChanges ? c.textFaint : '#FFFFFF' }}>
                Save changes
              </Text>
            )}
          </Pressable>
          <Pressable onPress={onReset} hitSlop={8} className="mt-2 items-center">
            <Text className="text-[11px]" style={{ color: c.textMuted }}>
              Reset profile
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </PopupCard>
  );
}
