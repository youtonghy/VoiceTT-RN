import type { Href } from 'expo-router';

import type { AppIconName } from '@/components/native/app-shell';

export type RouteHref = Extract<Href, string>;

export type SettingsEntryKey =
  | 'recording'
  | 'credentials'
  | 'transcription'
  | 'translation'
  | 'summary'
  | 'qa'
  | 'tts'
  | 'appearance'
  | 'export'
  | 'keyboard';

export interface SettingsMenuEntry {
  key: SettingsEntryKey;
  route: RouteHref;
  title: string;
  subtitle: string;
  icon: AppIconName;
  isPriority?: boolean;
}

export interface SettingsMenuGroup {
  key: 'essentials' | 'workflow' | 'preferences' | 'extras';
  title: string;
  subtitle: string;
  entries: SettingsMenuEntry[];
}

type Translate = (key: string) => string;

const SETTINGS_ENTRY_CONFIG: Record<
  SettingsEntryKey,
  {
    route: RouteHref;
    titleKey: string;
    subtitleKey: string;
    icon: AppIconName;
    isPriority?: boolean;
  }
> = {
  recording: {
    route: '/settings/recording' as RouteHref,
    titleKey: 'settings.sections.recording.title',
    subtitleKey: 'settings.sections.recording.subtitle',
    icon: 'microphone',
    isPriority: true,
  },
  credentials: {
    route: '/settings/credentials' as RouteHref,
    titleKey: 'settings.sections.credentials.title',
    subtitleKey: 'settings.sections.credentials.subtitle',
    icon: 'key',
    isPriority: true,
  },
  transcription: {
    route: '/settings/transcription' as RouteHref,
    titleKey: 'settings.sections.transcription.title',
    subtitleKey: 'settings.sections.transcription.subtitle',
    icon: 'wave-square',
  },
  translation: {
    route: '/settings/translation' as RouteHref,
    titleKey: 'settings.sections.translation.title',
    subtitleKey: 'settings.sections.translation.subtitle',
    icon: 'language',
  },
  summary: {
    route: '/settings/summary' as RouteHref,
    titleKey: 'settings.sections.summary.title',
    subtitleKey: 'settings.sections.summary.subtitle',
    icon: 'file-lines',
  },
  qa: {
    route: '/settings/qa' as RouteHref,
    titleKey: 'settings.sections.qa.title',
    subtitleKey: 'settings.sections.qa.subtitle',
    icon: 'circle-question',
  },
  tts: {
    route: '/settings/tts' as RouteHref,
    titleKey: 'settings.sections.tts.title',
    subtitleKey: 'settings.sections.tts.subtitle',
    icon: 'volume-high',
  },
  appearance: {
    route: '/settings/appearance' as RouteHref,
    titleKey: 'settings.sections.appearance.title',
    subtitleKey: 'settings.sections.appearance.subtitle',
    icon: 'palette',
  },
  export: {
    route: '/settings/export' as RouteHref,
    titleKey: 'settings.sections.export.title',
    subtitleKey: 'settings.sections.export.subtitle',
    icon: 'file-export',
  },
  keyboard: {
    route: '/settings/keyboard' as RouteHref,
    titleKey: 'settings.sections.keyboard.title',
    subtitleKey: 'settings.sections.keyboard.subtitle',
    icon: 'keyboard',
  },
};

const SETTINGS_MENU_GROUP_CONFIG: {
  key: SettingsMenuGroup['key'];
  titleKey: string;
  subtitleKey: string;
  entries: SettingsEntryKey[];
}[] = [
  {
    key: 'essentials',
    titleKey: 'settings.groups.essentials.title',
    subtitleKey: 'settings.groups.essentials.subtitle',
    entries: ['recording', 'credentials'],
  },
  {
    key: 'workflow',
    titleKey: 'settings.groups.workflow.title',
    subtitleKey: 'settings.groups.workflow.subtitle',
    entries: ['transcription', 'translation', 'summary', 'qa', 'tts'],
  },
  {
    key: 'preferences',
    titleKey: 'settings.groups.preferences.title',
    subtitleKey: 'settings.groups.preferences.subtitle',
    entries: ['appearance', 'export'],
  },
  {
    key: 'extras',
    titleKey: 'settings.groups.extras.title',
    subtitleKey: 'settings.groups.extras.subtitle',
    entries: ['keyboard'],
  },
];

export function buildSettingsMenuGroups(t: Translate): SettingsMenuGroup[] {
  return SETTINGS_MENU_GROUP_CONFIG.map((group) => ({
    key: group.key,
    title: t(group.titleKey),
    subtitle: t(group.subtitleKey),
    entries: group.entries.map((entryKey) => {
      const entry = SETTINGS_ENTRY_CONFIG[entryKey];
      return {
        key: entryKey,
        route: entry.route,
        title: t(entry.titleKey),
        subtitle: t(entry.subtitleKey),
        icon: entry.icon,
        isPriority: entry.isPriority,
      };
    }),
  }));
}
