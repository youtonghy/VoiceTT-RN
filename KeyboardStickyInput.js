import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

const DEFAULT_KEYBOARD_HEIGHT = 300;

// 估算底部安全区高度，适配带有手势导航或刘海屏的设备
const getEstimatedBottomInset = () => {
  const screen = Dimensions.get('screen');
  const window = Dimensions.get('window');

  if (!screen || !window) {
    return 0;
  }

  const heightDiff = Math.max(screen.height - window.height, 0);

  if (Platform.OS === 'android') {
    // Android 返回值可能包含状态栏，减去当前状态栏高度后取非负值
    const statusBarHeight = StatusBar.currentHeight || 0;
    return Math.max(heightDiff - statusBarHeight, 0);
  }

  return heightDiff;
};

const resolveKeyboardHeight = (event) => {
  const heightFromEvent = event?.endCoordinates?.height;

  if (typeof heightFromEvent === 'number' && heightFromEvent > 0) {
    return heightFromEvent;
  }

  // 某些设备可能无法返回键盘高度，提供退路，避免组件悬空
  return DEFAULT_KEYBOARD_HEIGHT;
};

const KeyboardStickyInput = forwardRef((props, ref) => {
  const {
    containerStyle,
    inputContainerStyle,
    inputStyle,
    placeholder,
    value,
    onChangeText,
    multiline = false,
    accessory,
    children,
    layoutBottomInset = 0,
    toolbar,
    ...rest
  } = props;

  const bottomOffset = useRef(new Animated.Value(0)).current;
  const keyboardHeightRef = useRef(0);
  const safeAreaBottomRef = useRef(getEstimatedBottomInset());
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const animateTo = useCallback(
    (target) => {
      Animated.timing(bottomOffset, {
        toValue: target,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    },
    [bottomOffset]
  );

  useEffect(() => {
    const handleKeyboardShow = (event) => {
      const keyboardHeight = resolveKeyboardHeight(event);
      keyboardHeightRef.current = keyboardHeight;

      const safeAreaBottom = safeAreaBottomRef.current;
      const offset = Math.max(
        keyboardHeight - safeAreaBottom - layoutBottomInset,
        0,
      );
      animateTo(offset);
      setIsKeyboardVisible(true);
    };

    const handleKeyboardHide = () => {
      keyboardHeightRef.current = 0;
      animateTo(0);
      setIsKeyboardVisible(false);
    };

    const showEvent = Platform.select({ ios: 'keyboardWillShow', default: 'keyboardDidShow' });
    const hideEvent = Platform.select({ ios: 'keyboardWillHide', default: 'keyboardDidHide' });

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    const handleDimensionChange = () => {
      safeAreaBottomRef.current = getEstimatedBottomInset();

      if (keyboardHeightRef.current > 0) {
        const correctedOffset = Math.max(
          keyboardHeightRef.current - safeAreaBottomRef.current - layoutBottomInset,
          0,
        );
        animateTo(correctedOffset);
      }
    };

    const dimsListener = Dimensions.addEventListener
      ? Dimensions.addEventListener('change', handleDimensionChange)
      : null;

    return () => {
      showSubscription?.remove?.();
      hideSubscription?.remove?.();

      if (dimsListener && typeof dimsListener.remove === 'function') {
        dimsListener.remove();
      } else if (Dimensions.removeEventListener) {
        Dimensions.removeEventListener('change', handleDimensionChange);
      }
    };
  }, [animateTo, layoutBottomInset]);

  useEffect(() => {
    if (keyboardHeightRef.current > 0) {
      const correctedOffset = Math.max(
        keyboardHeightRef.current - safeAreaBottomRef.current - layoutBottomInset,
        0,
      );
      animateTo(correctedOffset);
    } else {
      animateTo(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutBottomInset]);

  return (
    <SafeAreaView style={[styles.safeArea, containerStyle]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.animatedContainer,
          isKeyboardVisible && styles.animatedContainerKeyboard,
          { bottom: bottomOffset },
        ]}
      >
        {toolbar ? <View style={styles.toolbarContainer}>{toolbar}</View> : null}
        <View style={[styles.inputWrapper, inputContainerStyle]}>
          <TextInput
            ref={ref}
            style={[styles.input, multiline && styles.multilineInput, inputStyle]}
            placeholder={placeholder}
            value={value}
            onChangeText={onChangeText}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            {...rest}
          />
          {children /* 子元素可用于追加发送按钮、附件入口等 */}
        </View>
        {accessory}
      </Animated.View>
    </SafeAreaView>
  );
});

KeyboardStickyInput.displayName = 'KeyboardStickyInput';

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  animatedContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  animatedContainerKeyboard: {
    paddingBottom: 0,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#222222',
    padding: 0,
  },
  multilineInput: {
    minHeight: 80,
  },
  toolbarContainer: {
    marginBottom: 12,
  },
});

export default KeyboardStickyInput;

// 使用说明：
// - 将组件放置在页面根节点内，例如屏幕底部；组件会自动监听键盘高度并吸附在键盘上方。
// - 可通过 accessory prop 插入附加操作区域（例如发送按钮）。
//
// 示例：
// import React, { useState } from 'react';
// import { View, ScrollView, StyleSheet, Text } from 'react-native';
// import KeyboardStickyInput from './KeyboardStickyInput';
//
// const ConversationScreen = () => {
//   const [value, setValue] = useState('');
//
//   return (
//     <View style={styles.container}>
//       <ScrollView contentContainerStyle={styles.messages}>
//         <Text style={styles.placeholder}>聊天内容区域</Text>
//       </ScrollView>
//       <KeyboardStickyInput
//         placeholder="输入内容..."
//         value={value}
//         onChangeText={setValue}
//         accessory={(
//           <Text style={styles.sendButton} onPress={() => {/* 发送逻辑 */}}>
//             发送
//           </Text>
//         )}
//       />
//     </View>
//   );
// };
//
// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#F5F5F5' },
//   messages: { flexGrow: 1, padding: 16 },
//   placeholder: { color: '#888888', fontSize: 14 },
//   sendButton: { marginLeft: 12, color: '#2979FF', fontSize: 16 },
// });
