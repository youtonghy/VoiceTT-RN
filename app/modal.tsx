/**
 * 页面名称：模态窗口 (Modal Screen)
 * 文件路径：app/modal.tsx
 * 功能描述：展示一个模态对话框，通常用于显示临时信息或简单的交互。
 */

import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ModalScreen() {
  return (
    <ThemedView style={styles.container}>
      {/* 标题区域 */}
      <ThemedText type="title">This is a modal</ThemedText>
      
      {/* 返回链接 */}
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">Go to home screen</ThemedText>
      </Link>
    </ThemedView>
  );
}

// 样式定义
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
