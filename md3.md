任务目标（Task）
为我生成一个最小但完整的 Expo React Native 项目（JavaScript），演示如何在 Expo 应用中实现 Material Design 3（M3 / Material You）主题，包括：
1. 在 Android 12+ 上自动读取系统 Monet（动态）配色并应用到应用主题（primary、secondary、surface 等）。  
2. 在不支持系统动态色的环境（如 Expo Go、iOS、旧 Android）回退到基于 seed color 的 M3 生成色（使用 material-color-utilities）。  
3. 使用 react-native-paper 的 MD3 主题（Paper v5 风格）来渲染 Card（卡片）和特色按钮，并确保在主题变更时组件颜色同步。  
4. 提供清晰的运行 & 测试步骤（包括 Expo dev build / prebuild 在 Android 上测试动态配色的要点）。

关键依赖（Dependencies）
- react-native-paper (用于 MD3 组件和主题)  
- @pchmn/expo-material3-theme (用于读取系统 Material 3 动态主题并与 react-native-paper 兼容)。注意：该库在 managed Expo 中可安装，但要在真机上读取系统色需要 development build / 自定义构建。:contentReference[oaicite:1]{index=1}  
- @material/material-color-utilities (用于在 JS 端从 seed color 生成 M3 tonal palettes 作为回退)。:contentReference[oaicite:2]{index=2}

输出要求（What to output）
- 给出 `package.json`（dependencies）、项目文件结构说明。  
- 生成下列文件内容（粘贴完整文件代码）：
  - `App.js`（入口，使用 ThemeProvider 将主题提供给应用）  
  - `src/Material3ThemeProvider.js`（封装 useMaterial3Theme -> 转成 react-native-paper 的 theme，并提供 update/reset API）  
  - `src/components/ThemedCard.js`（示例卡片，使用 react-native-paper 的 Card）  
  - `src/components/ThemedButton.js`（示例特色按钮，展示 contained / elevated 样式与动画占位）  
  - `README.md`（说明如何安装、在 Expo Go 与 development build / 真机测试、如何验证动态配色生效）

实现细节要求（Implementation specifics）
- `Material3ThemeProvider.js` 必须：
  - 使用 `useMaterial3Theme({ fallbackSourceColor: '#6750A4' })`（或类似 API）来读取或生成 theme（参照库 API）。当设备支持动态色（Android 12+）时，theme 使用系统颜色；否则生成基于 fallbackSourceColor 的主题。:contentReference[oaicite:3]{index=3}
  - 将得到的 `theme.light` / `theme.dark` 映射并合并入 react-native-paper 的 `MD3LightTheme` / `MD3DarkTheme`（确保 `colors` 字段被替换）。示例：`paperTheme = colorScheme === 'dark' ? { ...MD3DarkTheme, colors: theme.dark } : { ...MD3LightTheme, colors: theme.light }`。:contentReference[oaicite:4]{index=4}
  - 对外提供 `useMaterial3ThemeContext()` Hook，用于组件更新主题（`updateTheme(seedColor)` / `resetTheme()`）。
- 必须在代码注释中清楚指出：在 **Expo Go** 中无法读取系统动态色（你会收到 fallback）；要在 Android 真机上读取系统动态色，需要用 **development build / 自定义构建** 或者在 bare workflow 中运行（参照 README）。提醒使用 `npx expo prebuild --platform android` / `npx expo run:android` 在本地生成并运行带原生模块的开发客户端（说明放在 README）。:contentReference[oaicite:5]{index=5}
- 在 README 中包含验证步骤：如何在支持动态主题的设备上（Android 12/13）通过更换壁纸或系统主题看到应用颜色与系统同步（并列出关键日志/UI 视觉点以便确认，如 primary / primaryContainer / surface 是否变动）。同时说明如何在 iOS / Expo Go 上观察回退色。
- 在示例组件里展示：
  - 一个 `Card`（Card.Title、Card.Content、Card.Actions），并用 theme 的 surface/surfaceVariant/background。  
  - 一个“特色按钮”（ThemedButton），使用 `Button mode="contained"` 或适合 MD3 的 variant，示范从 theme 读取 `primary` / `onPrimary` / `elevation` 的用法。
- 代码风格：保持 JS (非 TypeScript)，函数组件，使用 React Hooks（`useMemo`, `useEffect`），并加充分注释，便于读懂每一步做了什么。

安全与可访问性（Accessibility）
- 使用 `@material/material-color-utilities` 或库提供的 onColor 计算确保文字/图标对比度（即 `onPrimary` 能够与 `primary` 有足够对比），并在 README 中提醒检查 WCAG 对比度。

引用资料（for context）
- `expo-material3-theme` README 与 API（useMaterial3Theme / getMaterial3Theme / createMaterial3Theme）。强调：该包会在不支持的设备上返回 fallback 主题。:contentReference[oaicite:6]{index=6}  
- `@material/material-color-utilities` 用于生成 M3 tonal palettes / contrast。:contentReference[oaicite:7]{index=7}  
- react-native-paper 的 MD3 Theming 指南（展示如何把 M3 theme 注入 Paper）。:contentReference[oaicite:8]{index=8}  
- Android 官方动态配色（Monet / system_accent / theme styles）的文档（作为实现细节参考）。:contentReference[oaicite:9]{index=9}

测试说明（Testing）
- 在开发流程里写明三种情景的测试方法：
  1. **Expo Go**：`expo start` -> 打开手机 Expo Go，可以运行，但 `expo-material3-theme` 会返回 fallback（不能读取系统动态色）。检查界面是否使用 fallback seed 色生成的主题。:contentReference[oaicite:10]{index=10}  
  2. **Development client（推荐测试动态色）**：安装库后运行 `npx expo prebuild --platform android` 然后 `npx expo run:android` 或使用 EAS/自定义 dev client。更改 Android 壁纸/系统主题，观察 app 颜色变化以验证系统 Monet 色被读取并应用。:contentReference[oaicite:11]{index=11}  
  3. **iOS / 旧 Android**：应显示回退生成的 M3 主题（seed color-based）。检查对比度（onPrimary / onSurface）以保证可访问性。

风格与输出要求（codex 指令风格）
- 直接输出文件内容，不要多余解释。  
- 把每个文件包在单独的 Markdown 代码块里，并写明文件路径（例如：```javascript // App.js ```）。  
- README 用 markdown 完整写出安装/运行/测试步骤与注意事项。

质量期望（acceptance）
- 项目能在 Expo 管理工作流里安装依赖并运行（Expo Go 可运行回退主题；开发构建后可在 Android 真机读取系统主题）。  
- 代码清晰、有注释、能作为模板直接应用到真实项目中。

现在开始生成项目文件（包括 package.json、App.js、src/Material3ThemeProvider.js、示例组件、README.md），并确保所有关键环节（安装、prebuild、测试、对比度警告）都写明。
