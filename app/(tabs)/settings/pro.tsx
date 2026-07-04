import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'heroui-native';

import { Alert } from '@/components/app-alert';
import { AppCard, AppIcon, AppScreen, FormInput } from '@/components/native/app-shell';
import {
  activateProLicense,
  clearProLicense,
  getDeviceUid,
  getProStatus,
  syncTrustedTime,
  type ProStatus,
} from '@/services/pro';

export default function ProScreen() {
  const { t, i18n } = useTranslation();
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

  const handleSyncTime = useCallback(async () => {
    setIsBusy(true);
    try {
      await syncTrustedTime();
      await refreshStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t('settings.pro.errors.sync_failed', { message }));
    } finally {
      setIsBusy(false);
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
    return new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(status.expiresAtMs));
  }, [i18n.language, status, t]);

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
    <AppScreen
      title={t('settings.pro.title')}
      subtitle={t('settings.pro.description')}
      edges={['left', 'right']}
      contentTopInset={0}
      scrollContentInsetAdjustmentBehavior="never">
      <AppCard
        icon={status?.isActive ? 'shield-halved' : 'gem'}
        title={t('settings.pro.fields.status')}
        subtitle={showSyncHint ? t('settings.pro.messages.need_online_time') : undefined}
        action={
          <View
            className={[
              'rounded-full px-3 py-1',
              status?.isActive ? 'bg-success/15' : 'bg-danger/15',
            ].join(' ')}>
            <Text
              type="body-xs"
              weight="bold"
              className={status?.isActive ? 'text-success' : 'text-danger'}>
              {statusLabel}
            </Text>
          </View>
        }>
        <View className="gap-2">
          <Text type="body-sm" color="muted">
            {t('settings.pro.fields.device_uid')}
          </Text>
          <View className="flex-row items-center gap-2 rounded-xl bg-surface-secondary p-3">
            <Text type="code" numberOfLines={1} className="min-w-0 flex-1">
              {deviceUid || '--'}
            </Text>
            <Button
              accessibilityLabel={t('settings.pro.actions.copy_device_uid')}
              isDisabled={!deviceUid}
              isIconOnly
              onPress={handleCopyDeviceUid}
              size="sm"
              variant="tertiary">
              <AppIcon name="copy" size={15} className="text-foreground" />
            </Button>
          </View>
        </View>
      </AppCard>

      <AppCard icon="key" title={t('settings.pro.fields.license_id')}>
        <View className="gap-3">
          <ProInfoRow label={t('settings.pro.fields.license_id')} value={licenseIdText} mono />
          <ProInfoRow label={t('settings.pro.fields.plan_days')} value={planDaysText} />
          <ProInfoRow label={t('settings.pro.fields.expires_at')} value={expiresAtText} />
          <ProInfoRow label={t('settings.pro.fields.bound_device')} value={boundDeviceText} mono />
        </View>
      </AppCard>

      <AppCard icon="lock" title={t('settings.pro.fields.license_code')}>
        <FormInput
          label={t('settings.pro.fields.license_code')}
          value={licenseDraft}
          onChangeText={setLicenseDraft}
          placeholder={t('settings.pro.placeholders.license_code')}
          multiline
          inputClassName="min-h-24"
          editable={!isBusy}
        />
        <View className="flex-row flex-wrap gap-2">
          <Button
            isDisabled={isBusy || licenseDraft.trim().length === 0}
            onPress={handleActivate}
            variant="primary">
            <Button.Label>{t('settings.pro.actions.activate')}</Button.Label>
          </Button>
          <Button isDisabled={isBusy} onPress={handleClear} variant="danger-soft">
            <Button.Label>{t('settings.pro.actions.clear')}</Button.Label>
          </Button>
          {showSyncHint ? (
            <Button isDisabled={isBusy} onPress={handleSyncTime} variant="tertiary">
              <Button.Label>{t('settings.pro.actions.sync_time')}</Button.Label>
            </Button>
          ) : null}
        </View>
      </AppCard>
    </AppScreen>
  );
}

function ProInfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="gap-1 rounded-xl bg-surface-secondary p-3">
      <Text type="body-xs" color="muted">
        {label}
      </Text>
      <Text type={mono ? 'code' : 'body'} weight={mono ? undefined : 'semibold'} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
