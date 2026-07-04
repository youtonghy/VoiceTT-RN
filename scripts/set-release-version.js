const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const rawVersion = (process.argv[2] || '').trim();
const version = rawVersion.replace(/^v/i, '');
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

if (!semverPattern.test(version)) {
  console.error(
    `[set-release-version] Invalid version "${rawVersion}". Use a semver value like 0.4.0.`
  );
  process.exit(1);
}

function updateJson(relativePath, updater) {
  const filePath = path.join(rootDir, relativePath);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  updater(json);
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

function replaceIfExists(relativePath, replacements) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  fs.writeFileSync(filePath, content);
}

updateJson('package.json', (pkg) => {
  pkg.version = version;
});

updateJson('app.json', (appConfig) => {
  appConfig.expo = appConfig.expo || {};
  appConfig.expo.version = version;
});

replaceIfExists('android/app/build.gradle', [
  [/versionName\s+"[^"]+"/, `versionName "${version}"`],
]);

replaceIfExists('ios/VoiceTT/Info.plist', [
  [
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${version}$2`,
  ],
]);

replaceIfExists('ios/VoiceTT.xcodeproj/project.pbxproj', [
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`],
]);

console.log(version);
