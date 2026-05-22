import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { ComponentProps, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Input, PressableFeedback, Switch, Text, TextField } from 'heroui-native';
import { withUniwind } from 'uniwind';

export type AppIconName =
  | 'bars-staggered'
  | 'book-open'
  | 'box-archive'
  | 'brush'
  | 'chevron-right'
  | 'circle-half-stroke'
  | 'circle-info'
  | 'circle-question'
  | 'clock-rotate-left'
  | 'cloud-arrow-up'
  | 'comments'
  | 'copy'
  | 'desktop'
  | 'file-arrow-down'
  | 'file-export'
  | 'file-lines'
  | 'gear'
  | 'gem'
  | 'github'
  | 'globe'
  | 'keyboard'
  | 'key'
  | 'language'
  | 'layer-group'
  | 'lock'
  | 'magnifying-glass'
  | 'microphone'
  | 'mobile-screen'
  | 'moon'
  | 'paintbrush'
  | 'palette'
  | 'paper-plane'
  | 'question'
  | 'radio'
  | 'robot'
  | 'rocket'
  | 'server'
  | 'shield-halved'
  | 'sliders'
  | 'square'
  | 'square-poll-horizontal'
  | 'sun'
  | 'toggle-on'
  | 'volume-high'
  | 'wand-magic-sparkles'
  | 'wave-square';
export const AppIcon = withUniwind(FontAwesome6);

export function AppScreen({
  title,
  subtitle,
  children,
  action,
  scroll = true,
  edges = ['top', 'left', 'right'],
  contentTopInset,
  contentBottomInset,
  scrollContentInsetAdjustmentBehavior = 'automatic',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  scroll?: boolean;
  edges?: ComponentProps<typeof SafeAreaView>['edges'];
  contentTopInset?: number;
  contentBottomInset?: number;
  scrollContentInsetAdjustmentBehavior?: ComponentProps<typeof ScrollView>['contentInsetAdjustmentBehavior'];
}) {
  const insets = useSafeAreaInsets();
  const topInset = contentTopInset ?? 12;
  const bottomInset = contentBottomInset ?? 24 + insets.bottom;
  const content = (
    <View
      className={`gap-4 px-4 ${scroll ? '' : 'min-h-0 flex-1'}`}
      style={[
        styles.screenContent,
        !scroll && styles.screenContentFixed,
        { paddingTop: topInset },
        { paddingBottom: bottomInset },
      ]}>
      {title || subtitle || action ? (
        <View className="flex-row flex-wrap items-start justify-between gap-4">
          <View className="min-w-0 flex-1 gap-1">
            {title ? <Text.Heading type="h1">{title}</Text.Heading> : null}
            {subtitle ? <Text.Paragraph color="muted">{subtitle}</Text.Paragraph> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges} style={styles.flex}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          style={styles.flex}
          contentInsetAdjustmentBehavior={scrollContentInsetAdjustmentBehavior}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        <View className="flex-1" style={styles.flex}>{content}</View>
      )}
    </SafeAreaView>
  );
}

export function AppCard({
  children,
  title,
  subtitle,
  icon,
  action,
  bodyClassName = '',
  className = '',
}: {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: AppIconName;
  action?: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <Card className={`min-h-0 gap-4 border border-border ${className}`}>
      {title || subtitle || icon || action ? (
        <Card.Header className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-row flex-1 items-start gap-3">
            {icon ? (
              <View className="size-10 items-center justify-center rounded-lg bg-surface-secondary">
                <AppIcon name={icon} size={18} className="text-accent" />
              </View>
            ) : null}
            <View className="min-w-0 flex-1 gap-1">
              {title ? <Card.Title>{title}</Card.Title> : null}
              {subtitle ? <Card.Description>{subtitle}</Card.Description> : null}
            </View>
          </View>
          {action}
        </Card.Header>
      ) : null}
      {children ? <Card.Body className={`min-h-0 gap-4 ${bodyClassName}`}>{children}</Card.Body> : null}
    </Card>
  );
}

export function ActionCard({
  title,
  subtitle,
  icon,
  badge,
  onPress,
  accessibilityRole = 'button',
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon: AppIconName;
  badge?: ReactNode;
  onPress: () => void;
  accessibilityRole?: 'button' | 'link';
  className?: string;
}) {
  return (
    <PressableFeedback
      accessibilityRole={accessibilityRole}
      accessibilityLabel={title}
      className="rounded-2xl"
      onPress={onPress}>
      <Card className={`border border-border ${className}`}>
        <Card.Body className="flex-row items-center gap-3 p-3">
          <View className="size-11 items-center justify-center rounded-xl bg-surface-secondary">
            <AppIcon name={icon} size={19} className="text-accent" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text weight="semibold" numberOfLines={1}>
                {title}
              </Text>
              {badge}
            </View>
            {subtitle ? (
              <Text type="body-sm" color="muted" numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <AppIcon name="chevron-right" size={18} className="text-muted" />
        </Card.Body>
      </Card>
    </PressableFeedback>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'tertiary',
  isDisabled,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  variant?: ComponentProps<typeof Button>['variant'];
  isDisabled?: boolean;
}) {
  return (
    <Button
      accessibilityLabel={label}
      isDisabled={isDisabled}
      isIconOnly
      onPress={onPress}
      size="sm"
      variant={variant}>
      <AppIcon name={icon} size={16} className="text-foreground" />
    </Button>
  );
}

export function PrimaryButton({
  children,
  icon,
  onPress,
  variant = 'primary',
  isDisabled,
}: {
  children: string;
  icon?: AppIconName;
  onPress: () => void;
  variant?: ComponentProps<typeof Button>['variant'];
  isDisabled?: boolean;
}) {
  return (
    <Button isDisabled={isDisabled} onPress={onPress} variant={variant}>
      {icon ? <AppIcon name={icon} size={16} className="text-accent-foreground" /> : null}
      <Button.Label>{children}</Button.Label>
    </Button>
  );
}

export function SegmentControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: AppIconName; disabled?: boolean }[];
  onChange: (next: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2 rounded-xl bg-surface-secondary p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableFeedback
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: option.disabled }}
            isDisabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={styles.segmentItem}
            className={[
              'min-h-10 flex-row items-center justify-center gap-2 rounded-lg px-3',
              selected ? 'bg-accent' : 'bg-transparent',
              option.disabled ? 'opacity-50' : '',
            ].join(' ')}>
            {option.icon ? (
              <AppIcon
                name={option.icon}
                size={14}
                className={selected ? 'text-accent-foreground' : 'text-muted'}
              />
            ) : null}
            <Text
              type="body-sm"
              weight="semibold"
              className={selected ? 'text-accent-foreground' : 'text-foreground'}>
                {option.label}
              </Text>
          </PressableFeedback>
        );
      })}
    </View>
  );
}

export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  onBlur,
  description,
  multiline,
  numberOfLines,
  scrollEnabled,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  isDisabled,
  editable,
  inputClassName,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onBlur?: () => void;
  description?: string;
  multiline?: boolean;
  numberOfLines?: number;
  scrollEnabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: ComponentProps<typeof Input>['keyboardType'];
  autoCapitalize?: ComponentProps<typeof Input>['autoCapitalize'];
  autoCorrect?: ComponentProps<typeof Input>['autoCorrect'];
  isDisabled?: boolean;
  editable?: boolean;
  inputClassName?: string;
  style?: StyleProp<TextStyle>;
}) {
  const className = [multiline ? 'min-h-28' : null, inputClassName].filter(Boolean).join(' ');

  return (
    <TextField className="gap-2" isDisabled={isDisabled}>
      <Text type="body-sm" weight="semibold">
        {label}
      </Text>
      <Input
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        className={className || undefined}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        onBlur={onBlur}
        onChangeText={onChangeText}
        placeholder={placeholder}
        scrollEnabled={scrollEnabled}
        secureTextEntry={secureTextEntry}
        style={style}
        textAlignVertical={multiline ? 'top' : undefined}
        value={value}
        variant="secondary"
      />
      {description ? (
        <Text type="body-xs" color="muted">
          {description}
        </Text>
      ) : null}
    </TextField>
  );
}

export function SettingSwitch({
  title,
  subtitle,
  value,
  onChange,
  isDisabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  isDisabled?: boolean;
}) {
  return (
    <View
      className={[
        'flex-row items-center justify-between gap-4 rounded-xl bg-surface-secondary p-3',
        isDisabled ? 'opacity-55' : '',
      ].join(' ')}>
      <View className="flex-1 gap-1">
        <Text weight="semibold">{title}</Text>
        {subtitle ? (
          <Text type="body-sm" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch isSelected={value} isDisabled={isDisabled} onSelectedChange={onChange}>
        <Switch.Thumb />
      </Switch>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: AppIconName;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-12">
      <View className="size-14 items-center justify-center rounded-2xl bg-surface-secondary">
        <AppIcon name={icon} size={22} className="text-muted" />
      </View>
      <Text weight="semibold" align="center">
        {title}
      </Text>
      {subtitle ? (
        <Text type="body-sm" color="muted" align="center">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minHeight: 0,
  },
  screenContent: {
    gap: 16,
    paddingHorizontal: 16,
  },
  screenContentFixed: {
    flex: 1,
    minHeight: 0,
  },
  segmentItem: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});
