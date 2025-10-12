import type { ForwardRefExoticComponent, ReactNode, RefAttributes } from "react";
import type {
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from "react-native";

export interface KeyboardStickyInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  accessory?: ReactNode;
  toolbar?: ReactNode;
  children?: ReactNode;
  layoutBottomInset?: number;
}

declare const KeyboardStickyInput: ForwardRefExoticComponent<
  KeyboardStickyInputProps & RefAttributes<TextInput>
>;

export default KeyboardStickyInput;
