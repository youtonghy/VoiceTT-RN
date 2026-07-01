import 'react-native';

declare module 'react-native' {
  interface NativeModulesStatic {
    RealtimeAudioModule?: {
      start(): Promise<void>;
      stop(): Promise<void>;
      addListener?(eventName: string): void;
      removeListeners?(count: number): void;
    };
  }
}
