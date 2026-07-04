const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  IOSConfig,
  withDangerousMod,
  withAndroidManifest,
  withStringsXml,
  withMainApplication,
  withXcodeProject,
} = require('expo/config-plugins');
const {
  addBuildSourceFileToGroup,
  addFramework,
} = require('@expo/config-plugins/build/ios/utils/Xcodeproj');

const MODULE_NAME = 'RealtimeAudioModule';
const IOS_SWIFT_FILE = `${MODULE_NAME}.swift`;
const IOS_BRIDGE_FILE = `${MODULE_NAME}.m`;
const ANDROID_PACKAGE = 'com.unbaked0692.vtt.realtimeaudio';
const ANDROID_MODULE_FILE = `${MODULE_NAME}.kt`;
const ANDROID_PACKAGE_FILE = 'RealtimeAudioPackage.kt';
const ANDROID_SERVICE_FILE = 'RealtimeAudioForegroundService.kt';
const ANDROID_SERVICE_NAME = `${ANDROID_PACKAGE}.RealtimeAudioForegroundService`;
const ANDROID_NOTIFICATION_STRINGS = [
  {
    $: { name: 'realtime_audio_notification_title' },
    _: 'VoiceTT recording audio',
  },
  {
    $: { name: 'realtime_audio_notification_body' },
    _: 'Realtime transcription is running.',
  },
];

function copyFileSync(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function addIosSourceFile(project, projectName, filename) {
  if (project.hasFile(filename)) {
    return;
  }
  const target = project.getTarget('com.apple.product-type.application');
  if (!target?.uuid) {
    throw new Error('Unable to find iOS application target for realtime audio module');
  }
  addBuildSourceFileToGroup({
    filepath: filename,
    groupName: projectName,
    project,
    targetUuid: target.uuid,
  });
}

function addIosFramework(project, projectName, framework) {
  if (project.hasFile(framework)) {
    return;
  }
  addFramework({
    project,
    projectName,
    framework,
  });
}

function withRealtimeAudioIos(config) {
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
      const iosSourceRoot = path.join(config.modRequest.platformProjectRoot, projectName);
      const pluginSourceRoot = path.join(__dirname, 'native', 'ios');
      copyFileSync(path.join(pluginSourceRoot, IOS_SWIFT_FILE), path.join(iosSourceRoot, IOS_SWIFT_FILE));
      copyFileSync(path.join(pluginSourceRoot, IOS_BRIDGE_FILE), path.join(iosSourceRoot, IOS_BRIDGE_FILE));
      return config;
    },
  ]);

  return withXcodeProject(config, (config) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    addIosSourceFile(config.modResults, projectName, IOS_SWIFT_FILE);
    addIosSourceFile(config.modResults, projectName, IOS_BRIDGE_FILE);
    addIosFramework(config.modResults, projectName, 'AVFoundation.framework');
    return config;
  });
}

function withRealtimeAudioAndroid(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.RECORD_AUDIO',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  ]);

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const pluginSourceRoot = path.join(__dirname, 'native', 'android');
      const destinationRoot = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...ANDROID_PACKAGE.split('.')
      );
      copyFileSync(
        path.join(pluginSourceRoot, ANDROID_MODULE_FILE),
        path.join(destinationRoot, ANDROID_MODULE_FILE)
      );
      copyFileSync(
        path.join(pluginSourceRoot, ANDROID_PACKAGE_FILE),
        path.join(destinationRoot, ANDROID_PACKAGE_FILE)
      );
      copyFileSync(
        path.join(pluginSourceRoot, ANDROID_SERVICE_FILE),
        path.join(destinationRoot, ANDROID_SERVICE_FILE)
      );
      return config;
    },
  ]);

  config = withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.service = application.service ?? [];
    const hasService = application.service.some(
      (service) => service.$?.['android:name'] === ANDROID_SERVICE_NAME
    );
    if (!hasService) {
      application.service.push({
        $: {
          'android:name': ANDROID_SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone',
        },
      });
    }
    return config;
  });

  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      ANDROID_NOTIFICATION_STRINGS,
      config.modResults
    );
    return config;
  });

  return withMainApplication(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('RealtimeAudioPackage()')) {
      return config;
    }
    const importLine = `import ${ANDROID_PACKAGE}.RealtimeAudioPackage`;
    let nextContents = contents.includes(importLine)
      ? contents
      : contents.replace(/package ([^\n]+)\n/, (match) => `${match}\n${importLine}\n`);
    if (/PackageList\(this\)\.packages\s*\.apply\s*\{/.test(nextContents)) {
      nextContents = nextContents.replace(
        /(PackageList\(this\)\.packages\s*\.apply\s*\{)/,
        `$1\n            add(RealtimeAudioPackage())`
      );
    } else if (/val packages = PackageList\(this\)\.packages/.test(nextContents)) {
      nextContents = nextContents.replace(
        /(val packages = PackageList\(this\)\.packages[^\n]*\n)/,
        `$1    packages.add(RealtimeAudioPackage())\n`
      );
    } else {
      throw new Error('Unable to register RealtimeAudioPackage in MainApplication');
    }
    config.modResults.contents = nextContents;
    return config;
  });
}

function withRealtimeAudio(config) {
  config = withRealtimeAudioIos(config);
  config = withRealtimeAudioAndroid(config);
  return config;
}

module.exports = withRealtimeAudio;
