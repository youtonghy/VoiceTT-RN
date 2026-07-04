import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as ReactNative from 'react-native';
import { Button, Dialog, Text } from 'heroui-native';

const { Platform, View } = ReactNative;

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  isPreferred?: boolean;
};

type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type AlertState = {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

type AlertContextValue = {
  show: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);
let webAlertHandler: AlertContextValue['show'] | null = null;

function fallbackWebAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
) {
  const body = message ? `${title}\n\n${message}` : title;
  const actionButtons = buttons?.length ? buttons : [{ text: 'OK' }];
  if (actionButtons.length > 1 && typeof window !== 'undefined') {
    const confirmed = window.confirm(body);
    const button = confirmed
      ? actionButtons.find((item) => item.style !== 'cancel') ?? actionButtons[actionButtons.length - 1]
      : actionButtons.find((item) => item.style === 'cancel');
    button?.onPress?.();
    if (!confirmed) {
      options?.onDismiss?.();
    }
    return;
  }
  if (typeof window !== 'undefined') {
    window.alert(body);
  }
  actionButtons[0]?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS !== 'web') {
      ReactNative.Alert.alert(title, message, buttons, options);
      return;
    }
    (webAlertHandler ?? fallbackWebAlert)(title, message, buttons, options);
  },
};

function normalizeButtons(buttons?: AlertButton[]) {
  if (buttons?.length) {
    return buttons;
  }
  return [{ text: 'OK' }];
}

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState | null>(null);

  const show = useCallback<AlertContextValue['show']>((title, message, buttons, options) => {
    setState({ title, message, buttons: normalizeButtons(buttons), options });
  }, []);

  const close = useCallback(
    (shouldDismiss: boolean) => {
      const onDismiss = state?.options?.onDismiss;
      setState(null);
      if (shouldDismiss) {
        onDismiss?.();
      }
    },
    [state?.options]
  );

  const value = useMemo(() => ({ show }), [show]);

  webAlertHandler = show;

  return (
    <AlertContext.Provider value={value}>
      {children}
      {Platform.OS === 'web' ? (
        <Dialog
          isOpen={state !== null}
          onOpenChange={(open) => {
            if (!open) {
              close(true);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content className="max-w-[420px] gap-4">
              {state ? (
                <>
                  <View className="gap-2">
                    <Dialog.Title>{state.title}</Dialog.Title>
                    {state.message ? (
                      <Dialog.Description>{state.message}</Dialog.Description>
                    ) : null}
                  </View>
                  <View className="flex-row flex-wrap justify-end gap-2">
                    {state.buttons.map((button, index) => {
                      const isDestructive = button.style === 'destructive';
                      const isCancel = button.style === 'cancel';
                      return (
                        <Button
                          key={`${button.text ?? 'button'}-${index}`}
                          variant={isDestructive ? 'danger-soft' : isCancel ? 'secondary' : 'primary'}
                          onPress={() => {
                            setState(null);
                            button.onPress?.();
                          }}
                        >
                          <Button.Label>
                            <Text>{button.text ?? 'OK'}</Text>
                          </Button.Label>
                        </Button>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      ) : null}
    </AlertContext.Provider>
  );
}

export function useAppAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAppAlert must be used inside AppAlertProvider');
  }
  return context;
}
