import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

export default function SettingsScreen() {
  return <ThemedView style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
