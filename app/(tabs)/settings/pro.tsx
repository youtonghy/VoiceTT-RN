import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  activateProLicense,
  clearProLicense,
  getDeviceUid,
  getProStatus,
  type ProStatus,
} from '@/services/pro';

import { SettingsCard, settingsStyles } from './shared';

export default function ProScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const safeAreaStyle = [
    settingsStyles.safeArea,
    isDark ? settingsStyles.safeAreaDark : settingsStyles.safeAreaLight,
  ];
  const [deviceUid, setDeviceUid] = useState('');
  const [licenseDraft, setLicenseDraft] = useState('');
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    setIsBusy(true);
    try {
      const [uid, currentStatus] = await Promise.all([getDeviceUid(), getProStatus()]);
      setDeviceUid(uid);
      setStatus(currentStatus);
    } catch (error) {
      console.error('[settings] Failed to refresh Pro status', error);
      setStatus(null);
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleActivate = useCallback(async () => {
    const trimmed = licenseDraft.trim();
    if (!trimmed) {
      return;
    }
    setIsBusy(true);
    try {
      await activateProLicense(trimmed);
      setLicenseDraft('');
      Alert.alert(t('settings.pro.messages.activated'));
    } catch (error) {
      console.error('[settings] Pro activation failed', error);
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t('settings.pro.errors.activation_failed', { message }));
    } finally {
      setIsBusy(false);
      void refreshStatus();
    }
  }, [licenseDraft, refreshStatus, t]);

  const handleCopyDeviceUid = useCallback(async () => {
    if (!deviceUid) {
      return;
    }
    try {
      await Clipboard.setStringAsync(deviceUid);
    } catch (error) {
      console.error('[settings] Failed to copy device UID', error);
    }
  }, [deviceUid]);

  const handleClear = useCallback(async () => {
    setIsBusy(true);
    try {
      await clearProLicense();
      Alert.alert(t('settings.pro.messages.cleared'));
    } finally {
      setIsBusy(false);
      void refreshStatus();
    }
  }, [refreshStatus, t]);

  const statusLabel = useMemo(() => {
    if (!status) {
      return t('settings.pro.status.inactive');
    }
    if (status.isActive) {
      return t('settings.pro.status.active');
    }
    switch (status.reason) {
      case 'expired':
        return t('settings.pro.status.expired');
      case 'needs_time_sync':
        return t('settings.pro.status.needs_time_sync');
      case 'time_rollback':
        return t('settings.pro.status.time_rollback');
      case 'device_mismatch':
        return t('settings.pro.status.device_mismatch');
      case 'not_active_yet':
        return t('settings.pro.status.not_active_yet');
      case 'invalid':
        return t('settings.pro.status.invalid');
      case 'no_license':
      default:
        return t('settings.pro.status.inactive');
    }
  }, [status, t]);

  const expiresAtText = useMemo(() => {
    if (!status) {
      return '--';
    }
    if (status.payload?.isLifetime || status.payload?.exp === 0) {
      return t('settings.pro.values.lifetime');
    }
    if (!status.expiresAtMs) {
      return '--';
    }
    return new Date(status.expiresAtMs).toLocaleString();
  }, [status, t]);

  const planDaysText =
    status?.payload?.isLifetime || status?.payload?.exp === 0
      ? t('settings.pro.values.lifetime')
      : status?.payload?.planDays
        ? String(status.payload.planDays)
        : '--';
  const licenseIdText = status?.payload?.licId ?? '--';
  const boundDeviceText = status?.boundDeviceUid ?? status?.payload?.deviceUid ?? '--';
  const showSyncHint = status?.reason === 'needs_time_sync' || status?.reason === 'time_rollback';

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={settingsStyles.pageHeader}>
          <ThemedText
            type="title"
            style={settingsStyles.pageTitle}
            lightColor="#0f172a"
            darkColor="#e2e8f0">
            {t('settings.pro.title')}
          </ThemedText>
          <ThemedText
            style={styles.pageSubtitle}
            lightColor="#475569"
            darkColor="#94a3b8">
            {t('settings.pro.description')}
          </ThemedText>
        </View>

        <SettingsCard>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel} lightColor="#64748b" darkColor="#94a3b8">
              {t('settings.pro.fields.status')}
            </ThemedText>
            <ThemedText
              style={[styles.fieldValue, status?.isActive ? styles.activeText : styles.inactiveText]}
              lightColor="#0f172a"
              darkColor="#e2e8f0">
              {statusLabel}
            </ThemedText>
          </View>
          {showSyncHint ? (
            <ThemedText
              style={styles.syncHint}
              lightColor="#b45309"
              darkColor="#fbbf24">
              {t('settings.pro.messages.need_online_time')}
            </ThemedText>
          ) : null}
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel} lightColor="#64748b" darkColor="#94a3b8">
              {t('settings.pro.fields.device_uid')}
            </ThemedText>
            <View style={styles.deviceUidRow}>
              <ThemedText
                style={styles.monoValue}
                lightColor="#0f172a"
                darkColor="#e2e8f0"
                numberOfLines={1}>
                {deviceUid || '--'}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy device UID"
                disabled={!deviceUid}
                onPress={handleCopyDeviceUid}
                style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}>
                <Ionicons
                  name="copy-outline"
                  size={16}
                  color={isDark ? '#bbf7d0' : '#166534'}
                />
              </Pressable>
            </View>
          </View>
        </SettingsCard>

        <SettingsCard>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel} lightColor="#64748b" darkColor="#94a3b8">
              {t('settings.pro.fields.license_id')}
            </ThemedText>
            <ThemedText style={styles.fieldValue} lightColor="#0f172a" darkColor="#e2e8f0">
              {licenseIdText}
            </ThemedText>
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel} lightColor="#64748b" darkColor="#94a3b8">
              {t('settings.pro.fields.plan_days')}
            </ThemedText>
            <ThemedText style={styles.fieldValue} lightColor="#0f172a" darkColor="#e2e8f0">
              {planDaysText}
            </ThemedText>
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel} lightColor="#64748b" darkColor="#94a3b8">
              {t('settings.pro.fields.expires_at')}
            </ThemedText>
            <ThemedText style={styles.fieldValue} lightColor="#0f172a" darkColor="#e2e8f0">
              {expiresAtText}
            </ThemedText>
          </View>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel} lightColor="#64748b" darkColor="#94a3b8">
              {t('settings.pro.fields.bound_device')}
            </ThemedText>
            <ThemedText style={styles.monoValue} lightColor="#0f172a" darkColor="#e2e8f0">
              {boundDeviceText}
            </ThemedText>
          </View>
        </SettingsCard>

        <SettingsCard>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel} lightColor="#64748b" darkColor="#94a3b8">
              {t('settings.pro.fields.license_code')}
            </ThemedText>
            <TextInput
              value={licenseDraft}
              onChangeText={setLicenseDraft}
              placeholder={t('settings.pro.placeholders.license_code')}
              placeholderTextColor={isDark ? '#94a3b8' : '#94a3b8'}
              style={[
                styles.licenseInput,
                { color: isDark ? '#e2e8f0' : '#0f172a' },
              ]}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              editable={!isBusy}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.actionRow}>
            <Pressable
              disabled={isBusy || licenseDraft.trim().length === 0}
              onPress={handleActivate}
              style={({ pressed }) => [styles.actionPressable, pressed && styles.actionPressed]}>
              <ThemedView
                lightColor="#2563eb"
                darkColor="#2563eb"
                style={styles.actionButton}>
                <ThemedText style={styles.actionText} lightColor="#ffffff" darkColor="#ffffff">
                  {t('settings.pro.actions.activate')}
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              disabled={isBusy}
              onPress={handleClear}
              style={({ pressed }) => [styles.actionPressable, pressed && styles.actionPressed]}>
              <ThemedView
                lightColor="#fee2e2"
                darkColor="#3f1d1d"
                style={styles.actionButton}>
                <ThemedText
                  style={styles.secondaryText}
                  lightColor="#b91c1c"
                  darkColor="#fecaca">
                  {t('settings.pro.actions.clear')}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 18,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  fieldRow: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    opacity: 0.75,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  monoValue: {
    fontSize: 14,
    fontFamily: 'Courier',
  },
  activeText: {
    color: '#16a34a',
  },
  inactiveText: {
    color: '#dc2626',
  },
  deviceUidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copyButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  copyButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  syncHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  licenseInput: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    padding: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionPressable: {
    borderRadius: 14,
  },
  actionPressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  actionButton: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
