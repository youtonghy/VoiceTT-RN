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
import { Card, Text, useThemeColor } from "heroui-native";

import { AppIcon, type AppIconName } from "@/components/native/app-shell";

export type ContextMenuAction = {
  label: string;
  icon?: AppIconName;
  subActions?: ContextMenuAction[];
  onPress?: () => void;
  variant?: "cancel" | "destructive";
  dismissOnPress?: boolean;
  isDisabled?: boolean;
};

export type ContextMenuAnchor = {
  x: number;
  y: number;
  alignX?: "start" | "end";
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

function estimateMenuHeight(actionCount: number, hasTitle: boolean): number {
  const titleHeight = hasTitle ? MENU_TITLE_HEIGHT + MENU_TITLE_GAP : 0;
  const itemsHeight =
    actionCount * MENU_ITEM_HEIGHT +
    Math.max(actionCount - 1, 0) * MENU_ITEM_GAP;
  return MENU_PADDING * 2 + titleHeight + itemsHeight;
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
  const [desktopSubmenu, setDesktopSubmenu] = useState<{
    actions: ContextMenuAction[];
    index: number;
  } | null>(null);
  const [menuLayout, setMenuLayout] = useState<{ width: number; height: number } | null>(null);
  const [isMounted, setIsMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const previousVisibleRef = useRef(visible);
  const [surfaceBorder, pressedBackground, sheetItemBackground] = useThemeColor([
    "border",
    "surface-secondary",
    "surface-secondary",
  ]);

  const visibleActions = useMemo(
    () =>
      isDesktop
        ? renderState.actions.filter((action) => action.variant !== "cancel")
        : renderState.actions,
    [isDesktop, renderState.actions]
  );

  const desktopSubmenuActions = useMemo(
    () => desktopSubmenu?.actions.filter((action) => action.variant !== "cancel") ?? [],
    [desktopSubmenu]
  );

  const estimatedHeight = useMemo(() => {
    return estimateMenuHeight(visibleActions.length, Boolean(renderState.title));
  }, [renderState.title, visibleActions.length]);

  const menuHeight = menuLayout?.height ?? estimatedHeight;
  const anchorX = renderState.anchor?.x ?? width / 2;
  const anchorY = renderState.anchor?.y ?? height / 2;
  const anchorLeft = renderState.anchor?.alignX === "end" ? anchorX - MENU_WIDTH : anchorX;
  const maxLeft = Math.max(MENU_MARGIN, width - MENU_WIDTH - MENU_MARGIN);
  const maxTop = Math.max(MENU_MARGIN, height - menuHeight - MENU_MARGIN);
  const left = clamp(anchorLeft, MENU_MARGIN, maxLeft);
  const top = clamp(anchorY, MENU_MARGIN, maxTop);
  const submenuHeight = estimateMenuHeight(desktopSubmenuActions.length, false);
  const submenuTop = desktopSubmenu
    ? clamp(
        top +
          MENU_PADDING +
          (renderState.title ? MENU_TITLE_HEIGHT + MENU_TITLE_GAP : 0) +
          desktopSubmenu.index * (MENU_ITEM_HEIGHT + MENU_ITEM_GAP),
        MENU_MARGIN,
        Math.max(MENU_MARGIN, height - submenuHeight - MENU_MARGIN)
      )
    : top;
  const submenuRightLeft = left + MENU_WIDTH + MENU_ITEM_GAP;
  const submenuPreferredLeft =
    submenuRightLeft + MENU_WIDTH + MENU_MARGIN <= width
      ? submenuRightLeft
      : left - MENU_WIDTH - MENU_ITEM_GAP;
  const submenuLeft = clamp(
    submenuPreferredLeft,
    MENU_MARGIN,
    Math.max(MENU_MARGIN, width - MENU_WIDTH - MENU_MARGIN)
  );

  useEffect(() => {
    if (visible) {
      setRenderState({ title, actions, anchor });
      setDesktopSubmenu(null);
      setMenuLayout(null);
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

  const handleActionPress = (action: ContextMenuAction, index: number) => {
    if (action.isDisabled) {
      return;
    }
    if (action.subActions?.length) {
      if (isDesktop) {
        setDesktopSubmenu({ actions: action.subActions, index });
      } else {
        const cancelAction = renderState.actions.find((item) => item.variant === "cancel");
        setRenderState({
          title: action.label,
          actions: cancelAction ? [...action.subActions, cancelAction] : action.subActions,
          anchor: renderState.anchor,
        });
      }
      return;
    }
    if (action.dismissOnPress !== false) {
      onRequestClose();
    }
    action.onPress?.();
  };

  const renderActionContent = (action: ContextMenuAction, iconSize: number) => (
    <View style={styles.menuItemContent}>
      {action.icon ? (
        <View style={styles.menuItemIcon}>
          <AppIcon
            name={action.icon}
            size={iconSize}
            className={
              action.variant === "cancel" || action.variant === "destructive"
                ? "text-danger"
                : "text-muted"
            }
          />
        </View>
      ) : null}
      <Text
        type={isDesktop ? "body-sm" : "body"}
        weight="semibold"
        className={
          action.variant === "cancel" || action.variant === "destructive"
            ? "text-danger"
            : undefined
        }
        numberOfLines={1}
        style={[
          isDesktop ? styles.desktopMenuLabel : styles.sheetLabel,
          styles.menuItemLabel,
        ]}
      >
        {action.label}
      </Text>
      {action.subActions?.length ? (
        <AppIcon name="chevron-right" size={12} className="text-muted" />
      ) : null}
    </View>
  );

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
            <Card
              className="bg-surface"
              style={[styles.desktopMenuCard, { borderColor: surfaceBorder }]}
            >
              {renderState.title ? (
                <Text type="body-sm" weight="semibold" style={styles.desktopMenuTitle}>
                  {renderState.title}
                </Text>
              ) : null}
              <View style={styles.desktopMenuList}>
                {visibleActions.map((action, index) => (
                  <Pressable
                    key={`${action.label}-${index}`}
                    onHoverIn={() => {
                      if (action.isDisabled) {
                        return;
                      }
                      if (action.subActions?.length) {
                        setDesktopSubmenu({ actions: action.subActions, index });
                      } else {
                        setDesktopSubmenu(null);
                      }
                    }}
                    onPress={() => handleActionPress(action, index)}
                    accessibilityState={{ disabled: action.isDisabled }}
                    style={({ pressed }) => [
                      styles.desktopMenuItem,
                      action.isDisabled && styles.disabledItem,
                      pressed && !action.isDisabled && { backgroundColor: pressedBackground },
                    ]}
                  >
                    {renderActionContent(action, 13)}
                  </Pressable>
                ))}
              </View>
            </Card>
          </Pressable>
          {desktopSubmenu && desktopSubmenuActions.length > 0 ? (
            <Pressable
              style={[
                styles.desktopMenuContainer,
                { left: submenuLeft, top: submenuTop, width: MENU_WIDTH },
              ]}
              onPress={() => {}}
            >
              <Card
                className="bg-surface"
                style={[styles.desktopMenuCard, { borderColor: surfaceBorder }]}
              >
                <View style={styles.desktopMenuList}>
                  {desktopSubmenuActions.map((action, index) => (
                    <Pressable
                      key={`${action.label}-${index}`}
                      onPress={() => handleActionPress(action, index)}
                      accessibilityState={{ disabled: action.isDisabled }}
                      style={({ pressed }) => [
                        styles.desktopMenuItem,
                        action.isDisabled && styles.disabledItem,
                        pressed && !action.isDisabled && { backgroundColor: pressedBackground },
                      ]}
                    >
                      {renderActionContent(action, 13)}
                    </Pressable>
                  ))}
                </View>
              </Card>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal transparent visible onRequestClose={onRequestClose}>
      <AnimatedPressable style={[styles.sheetBackdrop, { opacity }]} onPress={onRequestClose}>
        <Pressable style={styles.sheetCardPressable} onPress={() => {}}>
          <Card className="bg-surface" style={[styles.sheetCard, { borderColor: surfaceBorder }]}>
            {renderState.title ? (
              <Text
                type="h6"
                weight="bold"
                style={styles.sheetTitle}
              >
                {renderState.title}
              </Text>
            ) : null}
            <View style={styles.sheetList}>
              {visibleActions.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={() => handleActionPress(action, 0)}
                  accessibilityState={{ disabled: action.isDisabled }}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { backgroundColor: sheetItemBackground },
                    action.isDisabled && styles.disabledItem,
                    pressed && !action.isDisabled && styles.sheetItemPressed,
                  ]}
                >
                  {renderActionContent(action, 15)}
                </Pressable>
              ))}
            </View>
          </Card>
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
  desktopMenuLabel: {
    fontSize: 14,
  },
  menuItemContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  menuItemIcon: {
    alignItems: "center",
    width: 18,
  },
  menuItemLabel: {
    flex: 1,
    minWidth: 0,
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
  },
  sheetItemPressed: {
    opacity: 0.85,
  },
  disabledItem: {
    opacity: 0.5,
  },
  sheetLabel: {
    fontSize: 15,
  },
});
