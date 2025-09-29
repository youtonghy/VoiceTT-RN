目标（Goal）：
请生成一个用于 React Native（React Native, Android only）的可复用组件，文件名为 `KeyboardStickyInput.js`。功能：当唤起系统键盘（Android keyboard）时，输入框（TextInput）自动抬高并紧贴系统键盘的上边缘（即输入框底部与键盘顶端对齐），并在键盘收起时恢复原位。禁止使用外部库（例如 react-native-keyboard-aware-scroll-view 等），请只使用 React Native 内置 API（Keyboard, Animated, Dimensions, Platform, SafeAreaView 等）。

约束与要求（Requirements）：
1. 仅针对 Android（Android）。但代码应对 iOS 不报错（可优雅忽略或正常工作）。
2. **必须**使用 Keyboard 的事件（keyboardDidShow / keyboardDidHide 或 keyboardWillShow / keyboardWillHide，根据平台可兼容选择）来读取 `endCoordinates.height`，以确定键盘高度。
3. 使用 Animated（动画）平滑过渡位置变化，使抬高/回落有缓动效果。
4. 输入框要“贴着键盘”（flush to keyboard top）——即组件底部应与键盘顶部精确对齐（考虑安全区 SafeArea）。
5. 不依赖 windowSoftInputMode 的假设，但在注释中给出 AndroidManifest.xml 需要增加/确认的配置建议：`android:windowSoftInputMode="adjustResize"`（可作为可选说明）。
6. 提供示例使用（usage example）：如何把 `KeyboardStickyInput` 放在页面底部并正常工作。
7. 代码使用 JavaScript（非 TypeScript），写清楚注释（中文注释），兼容 React Native >=0.60。
8. 输出格式：只输出需要的文件内容，清晰标注文件名（例如 `// File: KeyboardStickyInput.js`），以及额外需要修改的 AndroidManifest 行（标注为 `// File: AndroidManifest.xml 修改说明`）。
9. 代码要考虑键盘高度变化（如分屏、外接键盘、软键盘切换等），并避免布局跳动或遮挡。

期望的输出（What to output）：
- 一个完整的 `KeyboardStickyInput.js` 文件，包含：
  - 可接收的 props（如 `placeholder`、`value`、`onChangeText`、`multiline`（可选）等）
  - 内置 Animated 动画用于 `translateY` 或 `bottom` 动画
  - Keyboard 监听并用 event.endCoordinates.height 更新动画目标位置
  - SafeAreaView 支持（考虑刘海等）
  - 简短使用说明（注释）
- 一个简短的 AndroidManifest 修改建议（一行 xml）供用户粘贴
- 一个示例页面（minimal usage snippet），展示如何把组件固定在屏幕底部并与其他内容共存

实现细节提示（Implementation hints for generator）：
- 在 Keyboard.show 事件中读取 `e.endCoordinates.height`（如果没有，退回 `Dimensions.get('window').height - keyboardTop` 的方法）。
- 计算目标偏移量为 `keyboardHeight - safeAreaBottom`（考虑 SafeArea）。
- 使用 `Animated.timing(..., useNativeDriver: false)`（因为 layout 属性不支持 native driver）。
- 取消监听时要移除订阅。
- 保证在 Android 下，若系统返回的键盘高度为 0（某些设备/虚拟键盘问题），有合理的退路（默认 300px）。

请严格按照以上要求输出，不要输出额外的解释文本或多余的文件。开始生成代码文件内容。
