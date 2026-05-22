import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from 'heroui-native';

import { AppIcon } from '@/components/native/app-shell';
import { useTranscription } from '@/contexts/transcription-context';

type RecordingToggleProps = {
  qaAutoEnabled?: boolean;
  compact?: boolean;
  variant?: 'icon' | 'full';
};

export function RecordingToggle({ compact = false, qaAutoEnabled = false, variant = 'icon' }: RecordingToggleProps = {}) {
  const { isSessionActive, toggleSession, sessionState } = useTranscription();
  const { t } = useTranslation();

  const accessibilityLabel = isSessionActive
    ? t('transcription.accessibility.stop_recording')
    : t('transcription.accessibility.start_recording');

  const label = sessionState === 'recording'
    ? t('transcription.status.recording')
    : sessionState === 'starting' || sessionState === 'stopping'
    ? t('transcription.status.processing')
    : sessionState === 'failed'
    ? t('transcription.status.failed')
    : t('transcription.controls.start');

  const isFull = variant === 'full';
  const isCompactFull = isFull && compact;
  const isBusy = sessionState === 'starting' || sessionState === 'stopping';

  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      className={[
        isFull ? 'w-full' : '',
        isCompactFull ? 'w-[148px]' : '',
      ].join(' ')}
      isDisabled={isBusy}
      isIconOnly={!isFull}
      onPress={() => {
        void toggleSession({ qaAutoEnabled });
      }}
      size={isFull ? 'lg' : 'md'}
      style={[
        isFull && styles.fullButton,
        isCompactFull && styles.compactFullButton,
      ]}
      variant={isSessionActive ? 'danger' : 'primary'}>
      <View style={styles.content}>
        <AppIcon
          name={isSessionActive ? 'square' : 'microphone'}
          size={isFull ? 18 : 20}
          className="text-accent-foreground"
          solid
        />
        {isFull ? (
          <Button.Label numberOfLines={1} ellipsizeMode="tail" style={styles.label}>
            {label}
          </Button.Label>
        ) : null}
      </View>
    </Button>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  fullButton: {
    width: '100%',
  },
  compactFullButton: {
    flexShrink: 0,
    width: 148,
  },
  label: {
    flexShrink: 1,
  },
});
