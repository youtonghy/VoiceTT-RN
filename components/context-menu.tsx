import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";

export type ContextMenuAction = {
  label: string;
  onPress?: () => void;
  variant?: "cancel" | "destructive";
};

export type ContextMenuAnchor = {
  x: number;
  y: number;
};

type ContextMenuProps = {
  visible: boolean;
  title?: string;
  actions: ContextMenuAction[];
  onRequestClose: () => void;
  anchor?: ContextMenuAnchor;
};

const MENU_WIDTH = 220;
const MENU_MARGIN = 12;
const MENU_ITEM_HEIGHT = 38;
const MENU_ITEM_GAP = 6;
const MENU_PADDING = 12;
const MENU_TITLE_HEIGHT = 24;
const MENU_TITLE_GAP = 8;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function ContextMenu({
  visible,
  title,
  actions,
  onRequestClose,
  anchor,
}: ContextMenuProps) {
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === "web";
  const [renderState, setRenderState] = useState<{
    title?: string;
    actions: ContextMenuAction[];
    anchor?: ContextMenuAnchor;
  }>({ title, actions, anchor });
  const [menuLayout, setMenuLayout] = useState<{ width: number; height: number } | null>(null);
  const [isMounted, setIsMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const previousVisibleRef = useRef(visible);
  const surfaceBorder = useThemeColor(
    { light: "rgba(148, 163, 184, 0.25)", dark: "rgba(148, 163, 184, 0.35)" },
    "background"
  );

  const visibleActions = useMemo(
    () =>
      isDesktop
        ? renderState.actions.filter((action) => action.variant !== "cancel")
        : renderState.actions,
    [isDesktop, renderState.actions]
  );

  const estimatedHeight = useMemo(() => {
    const titleHeight = renderState.title ? MENU_TITLE_HEIGHT + MENU_TITLE_GAP : 0;
    const itemsHeight =
      visibleActions.length * MENU_ITEM_HEIGHT +
      Math.max(visibleActions.length - 1, 0) * MENU_ITEM_GAP;
    return MENU_PADDING * 2 + titleHeight + itemsHeight;
  }, [renderState.title, visibleActions.length]);

  const menuHeight = menuLayout?.height ?? estimatedHeight;
  const anchorX = renderState.anchor?.x ?? width / 2;
  const anchorY = renderState.anchor?.y ?? height / 2;
  const maxLeft = Math.max(MENU_MARGIN, width - MENU_WIDTH - MENU_MARGIN);
  const maxTop = Math.max(MENU_MARGIN, height - menuHeight - MENU_MARGIN);
  const left = clamp(anchorX, MENU_MARGIN, maxLeft);
  const top = clamp(anchorY, MENU_MARGIN, maxTop);

  useEffect(() => {
    if (visible) {
      setRenderState({ title, actions, anchor });
    }
  }, [actions, anchor, title, visible]);

  useEffect(() => {
    const wasVisible = previousVisibleRef.current;
    previousVisibleRef.current = visible;
    if (isDesktop) {
      setIsMounted(visible);
      opacity.setValue(1);
      return;
    }
    opacity.stopAnimation();
    if (visible) {
      setIsMounted(true);
      if (!wasVisible) {
        opacity.setValue(0);
      }
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (wasVisible) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsMounted(false);
        }
      });
    }
  }, [isDesktop, opacity, visible]);

  const shouldRender = isDesktop ? visible : isMounted;

  if (!shouldRender || visibleActions.length === 0) {
    return null;
  }

  if (isDesktop) {
    return (
      <Modal transparent visible onRequestClose={onRequestClose}>
        <Pressable style={styles.desktopBackdrop} onPress={onRequestClose}>
          <Pressable
            style={[styles.desktopMenuContainer, { left, top, width: MENU_WIDTH }]}
            onPress={() => {}}
            onLayout={(event) => {
              const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
              if (!menuLayout || menuLayout.width !== layoutWidth || menuLayout.height !== layoutHeight) {
                setMenuLayout({ width: layoutWidth, height: layoutHeight });
              }
            }}
          >
            <ThemedView
              lightColor="#ffffff"
              darkColor="#0f172a"
              style={[styles.desktopMenuCard, { borderColor: surfaceBorder }]}
            >
              {title ? (
                <ThemedText style={styles.desktopMenuTitle} lightColor="#0f172a" darkColor="#e2e8f0">
                  {title}
                </ThemedText>
              ) : null}
              <View style={styles.desktopMenuList}>
                {visibleActions.map((action) => (
                  <Pressable
                    key={action.label}
                    onPress={() => {
                      onRequestClose();
                      action.onPress?.();
                    }}
                    style={({ pressed }) => [
                      styles.desktopMenuItem,
                      pressed && styles.desktopMenuItemPressed,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.desktopMenuLabel,
                        action.variant === "destructive" && styles.desktopMenuLabelDestructive,
                      ]}
                      lightColor="#0f172a"
                      darkColor="#e2e8f0"
                    >
                      {action.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal transparent visible onRequestClose={onRequestClose}>
      <AnimatedPressable style={[styles.sheetBackdrop, { opacity }]} onPress={onRequestClose}>
        <Pressable style={styles.sheetCardPressable} onPress={() => {}}>
          <ThemedView lightColor="#ffffff" darkColor="#0f172a" style={styles.sheetCard}>
            {title ? (
              <ThemedText
                type="subtitle"
                style={styles.sheetTitle}
                lightColor="#0f172a"
                darkColor="#e2e8f0"
              >
                {title}
              </ThemedText>
            ) : null}
            <View style={styles.sheetList}>
              {visibleActions.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={() => {
                    onRequestClose();
                    action.onPress?.();
                  }}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    pressed && styles.sheetItemPressed,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.sheetLabel,
                      (action.variant === "cancel" || action.variant === "destructive") &&
                        styles.sheetLabelCancel,
                    ]}
                    lightColor="#0f172a"
                    darkColor="#e2e8f0"
                  >
                    {action.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>
        </Pressable>
      </AnimatedPressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  desktopBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  desktopMenuContainer: {
    position: "absolute",
  },
  desktopMenuCard: {
    borderRadius: 12,
    padding: MENU_PADDING,
    gap: MENU_TITLE_GAP,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "rgba(15, 23, 42, 0.25)",
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  desktopMenuTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  desktopMenuList: {
    gap: MENU_ITEM_GAP,
  },
  desktopMenuItem: {
    minHeight: MENU_ITEM_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  desktopMenuItemPressed: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  desktopMenuLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  desktopMenuLabelDestructive: {
    color: "#ef4444",
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sheetCardPressable: {
    borderRadius: 20,
  },
  sheetCard: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.25)",
    shadowColor: "rgba(15, 23, 42, 0.2)",
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sheetList: {
    gap: 8,
  },
  sheetItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  sheetItemPressed: {
    opacity: 0.85,
  },
  sheetLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  sheetLabelCancel: {
    color: "#ef4444",
  },
});
