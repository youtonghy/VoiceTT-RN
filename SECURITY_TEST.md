# 安全修复测试指南

本指南说明如何验证2025-09-30实施的安全修复。

## 测试环境准备

```bash
# 1. 安装依赖
npm install

# 2. 清除旧数据（可选，用于全新测试）
# iOS模拟器: 设置 > 通用 > 重置 > 抹掉所有内容和设置
# Android模拟器: 设置 > 应用 > VTT > 清除数据

# 3. 启动应用
npm run ios   # 或
npm run android
```

## 测试清单

### ✅ 测试1: API密钥加密存储

**目标**: 验证API密钥存储在SecureStore中，而非明文AsyncStorage

**步骤**:
1. 首次启动应用
2. 进入设置页面
3. 输入OpenAI API密钥: `sk-test123...`
4. 返回首页，完全关闭应用
5. 重新启动应用
6. 进入设置，验证密钥已加载（显示为密钥长度或部分脱敏）

**验证方法**:
```bash
# iOS: 使用Keychain Access（真机）或模拟器钥匙串
# 查找 com.yourcompany.vtt 的钥匙串项目
# 应该看到 @agents/secure/credentials

# Android: 使用adb
adb shell run-as com.yourcompany.vtt
cd files
# 不应该在shared_prefs中看到明文API密钥
```

**预期结果**:
- ✅ API密钥在重启后正确恢复
- ✅ AsyncStorage中没有明文密钥（仅有空的credentials: {}）
- ✅ SecureStore中有加密的凭证数据

---

### ✅ 测试2: Gemini错误消息脱敏

**目标**: 验证错误消息不暴露API密钥

**步骤**:
1. 进入设置 > QA设置
2. 选择Gemini引擎
3. 输入**无效**的Gemini API密钥: `invalid-key-12345`
4. 返回首页
5. 开始录音并触发QA功能
6. 等待错误发生
7. 查看错误消息

**预期结果**:
- ✅ 错误消息显示: `Gemini API failed: [REDACTED]`
- ❌ 错误消息**不应该**包含: `invalid-key-12345`

**验证代码**:
```typescript
// services/transcription.ts:1105
// services/qa.ts:469
const safeError = errorText.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
```

---

### ✅ 测试3: 日志清理

**目标**: 验证生产模式下无敏感日志

**步骤**:
1. 以生产模式构建: `npm run build` 或 `eas build`
2. 安装生产版本
3. 输入有效API密钥
4. 进行一次完整的转写和QA流程
5. 查看设备日志

**验证方法**:
```bash
# iOS
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "vtt"'

# Android
adb logcat | grep -i vtt
```

**预期结果**:
- ❌ 日志中**不应该**出现:
  - API响应的完整JSON
  - 用户转写的文本内容
  - QA的问题和答案
  - `[qa] OpenAI response data:`
  - `[qa] Extracted text:`

- ✅ 可以出现:
  - 一般性错误: "QA extraction failed"
  - 状态变更: "Session started"

---

### ✅ 测试4: 设置重置清理

**目标**: 验证重置设置时SecureStore被清除

**步骤**:
1. 输入所有API密钥
2. 进入设置 > 高级 > 重置设置
3. 确认重置
4. 完全关闭应用
5. 重新打开
6. 检查设置页面

**预期结果**:
- ✅ 所有API密钥字段为空
- ✅ 其他设置恢复为默认值
- ✅ SecureStore已清除

**验证代码**:
```typescript
// contexts/settings-context.tsx:161-169
const resetSettings = useCallback(() => {
  runUpdate(() => defaultSettings);
  secureClearAll().catch(...);
}, [runUpdate]);
```

---

## 兼容性测试

### Web平台测试

**注意**: Web平台不支持SecureStore，会降级到AsyncStorage

**步骤**:
1. 运行: `npm run web`
2. 打开浏览器控制台
3. 输入API密钥
4. 查看控制台警告

**预期结果**:
- ⚠️ 应该看到警告: `[SecureStorage] Using unencrypted storage on web platform`
- ✅ 功能仍然正常工作
- ⚠️ 建议用户不要在公共设备上使用Web版本

---

## 回归测试

### 核心功能验证

确保安全修复没有破坏现有功能：

- ✅ 录音和转写正常
- ✅ 实时翻译正常
- ✅ 自动QA提取正常
- ✅ 手动QA触发正常
- ✅ 对话历史保存和加载正常
- ✅ 助手对话功能正常
- ✅ 多语言切换正常

---

## 安全验证工具

### 自动化脚本

创建测试脚本验证密钥不在明文存储中：

```bash
#!/bin/bash
# test-security.sh

echo "=== 安全验证测试 ==="

# 1. 检查AsyncStorage内容
echo "检查AsyncStorage..."
STORAGE_CONTENT=$(adb shell run-as com.yourcompany.vtt cat files/AsyncStorage/@agents/app-settings 2>/dev/null)

if echo "$STORAGE_CONTENT" | grep -q "apiKey.*sk-"; then
    echo "❌ 失败: 发现明文API密钥"
    exit 1
else
    echo "✅ 通过: AsyncStorage无明文密钥"
fi

# 2. 检查日志
echo "检查日志内容..."
LOGS=$(adb logcat -d | grep -i "api.*key\|sk-\|token.*:.*[A-Za-z0-9]{20}")

if [ -n "$LOGS" ]; then
    echo "⚠️  警告: 日志中可能包含敏感信息"
    echo "$LOGS"
else
    echo "✅ 通过: 日志无敏感信息"
fi

echo "=== 测试完成 ==="
```

---

## 问题排查

### 问题1: SecureStore初始化失败

**症状**: 应用启动时崩溃或无法保存设置

**原因**: expo-secure-store未正确链接

**解决**:
```bash
# iOS
cd ios && pod install

# Android
cd android && ./gradlew clean

# 重新构建
npm run ios/android
```

### 问题2: 密钥丢失

**症状**: 重启后API密钥为空

**原因**: SecureStore权限问题或迁移失败

**解决**:
```bash
# 1. 检查权限
# iOS: Info.plist中的Keychain权限
# Android: AndroidManifest.xml中的权限

# 2. 清除并重新输入
- 卸载应用
- 重新安装
- 重新输入密钥
```

### 问题3: Web版本不工作

**症状**: Web版本无法保存设置

**解决**: 检查浏览器LocalStorage是否启用，Web平台使用AsyncStorage作为降级方案。

---

## 下一步建议

完成P0修复后，建议在下个迭代中实施：

1. **输入验证**: 限制transcript最大长度，防止内存溢出
2. **频率限制**: 实现API调用节流，防止费用失控
3. **错误分类**: 创建用户友好的错误消息系统
4. **文件清理**: 增强音频文件自动清理机制

---

## 联系方式

如有问题或发现安全漏洞，请联系：
- 技术负责人: [邮箱]
- 安全团队: [邮箱]

**请勿在公开issue中披露安全问题！**
