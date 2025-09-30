# 第三方依赖安全审计指南

## 概述

本文档提供了审计项目第三方依赖安全性的指南和工具。

## 审计命令

### NPM 依赖审计

```bash
# 运行 npm 内置审计
npm audit

# 生成详细报告
npm audit --json > audit-report.json

# 自动修复已知漏洞(仅修复兼容更新)
npm audit fix

# 强制修复(可能引入破坏性更改)
npm audit fix --force
```

### Yarn 依赖审计(如果使用 Yarn)

```bash
# 运行 yarn 审计
yarn audit

# 生成 JSON 报告
yarn audit --json
```

## 推荐的第三方审计工具

### 1. Snyk

Snyk 是一个流行的安全扫描工具:

```bash
# 安装 Snyk CLI
npm install -g snyk

# 认证
snyk auth

# 测试项目
snyk test

# 监控项目
snyk monitor
```

### 2. npm-check-updates

检查依赖更新:

```bash
# 安装
npm install -g npm-check-updates

# 检查更新
ncu

# 交互式升级
ncu -i

# 升级所有依赖
ncu -u && npm install
```

## 定期审计流程

### 每周审计

1. 运行 `npm audit` 检查已知漏洞
2. 查看 GitHub Dependabot 警告(如果启用)
3. 检查关键依赖的安全公告

### 每月审计

1. 运行完整的 Snyk 扫描
2. 审查所有高危和中危漏洞
3. 更新依赖到最新安全版本
4. 测试更新后的应用功能

### 重大版本升级前

1. 审查所有依赖的变更日志
2. 运行完整的安全扫描
3. 在开发环境测试所有功能
4. 准备回滚计划

## 依赖安全最佳实践

### 1. 最小化依赖

- 仅添加必要的依赖
- 定期审查并移除未使用的依赖
- 优先选择维护良好的包

### 2. 锁定版本

- 使用 `package-lock.json` 或 `yarn.lock`
- 提交锁文件到版本控制
- 在 CI/CD 中使用 `npm ci` 而不是 `npm install`

### 3. 审查依赖树

```bash
# 查看依赖树
npm list --depth=0

# 查看特定包的依赖
npm list <package-name>

# 检查重复依赖
npm dedupe
```

### 4. 使用可信来源

- 从官方 npm registry 安装
- 验证包的维护者
- 检查下载量和社区支持

## 常见漏洞类型

### 1. 原型污染 (Prototype Pollution)
- **风险**: 允许攻击者修改 JavaScript 对象原型
- **缓解**: 更新到修复版本,避免使用不安全的对象合并

### 2. 跨站脚本 (XSS)
- **风险**: 允许注入恶意脚本
- **缓解**: 对所有用户输入进行清理,使用内容安全策略

### 3. 拒绝服务 (DoS)
- **风险**: 耗尽系统资源
- **缓解**: 实施输入验证和速率限制

### 4. 远程代码执行 (RCE)
- **风险**: 允许执行任意代码
- **缓解**: 立即更新,实施沙箱隔离

## 响应安全问题的流程

### 发现漏洞时:

1. **评估影响**
   - 检查漏洞的 CVSS 评分
   - 确定项目是否受影响
   - 评估潜在影响范围

2. **修复计划**
   - 优先处理高危漏洞
   - 检查是否有修复版本
   - 测试修复方案

3. **实施修复**
   - 更新依赖
   - 运行完整测试套件
   - 验证修复

4. **文档记录**
   - 记录漏洞详情
   - 记录修复步骤
   - 更新变更日志

## 项目特定的依赖审计

### React Native 依赖

特别关注:
- `expo` - 核心框架
- `react-native` - 移动框架
- `expo-secure-store` - 敏感数据存储

### 网络请求依赖

审计所有进行网络请求的包:
- 检查 TLS/SSL 实现
- 验证证书验证
- 审查错误处理

### 加密相关依赖

如果使用加密库:
- 确保使用最新版本
- 验证加密算法的安全性
- 检查随机数生成器

## 自动化审计

### GitHub Actions 示例

创建 `.github/workflows/security-audit.yml`:

```yaml
name: Security Audit

on:
  schedule:
    - cron: '0 0 * * 1' # 每周一运行
  push:
    branches: [ master ]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm audit --audit-level=moderate
```

## 报告漏洞

如果发现新的安全漏洞:

1. 不要在公开 issue 中披露
2. 联系项目维护者
3. 提供详细的复现步骤
4. 等待修复后再公开

## 资源

- [npm 安全最佳实践](https://docs.npmjs.com/packages-and-modules/securing-your-code)
- [OWASP 依赖检查](https://owasp.org/www-community/Component_Analysis)
- [Snyk 漏洞数据库](https://security.snyk.io/)
- [Node Security Platform](https://github.com/advisories)

## 审计检查清单

- [ ] 运行 `npm audit` 并解决所有高危漏洞
- [ ] 检查所有依赖是否有维护者
- [ ] 验证依赖的下载量和社区支持
- [ ] 审查依赖的许可证
- [ ] 检查是否有未使用的依赖
- [ ] 验证 package-lock.json 已提交
- [ ] 设置自动化安全扫描
- [ ] 文档记录已知的可接受风险
