import * as bunTest from "bun:test";
import { fromByteArray } from "base64-js";

const { describe, expect, test } = bunTest;
const mock = (bunTest as unknown as {
  mock: { module: (name: string, factory: () => unknown) => void };
}).mock;
const storage = new Map<string, string>();

mock.module("react-native", () => ({
  Platform: { OS: "web" },
}));

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: async (key: string) => {
      storage.delete(key);
    },
  },
}));

mock.module("expo-secure-store", () => ({
  isAvailableAsync: async () => false,
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

mock.module("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA512: "SHA-512" },
  digest: async () => new Uint8Array(64),
  getRandomBytesAsync: async (length: number) => new Uint8Array(length),
}));

mock.module("expo-asset", () => ({
  Asset: {
    fromModule: () => ({
      localUri: null,
      uri: "https://example.test/pro-public.toml",
      downloadAsync: async () => undefined,
    }),
  },
}));

mock.module("expo-file-system/legacy", () => ({
  EncodingType: { UTF8: "utf8" },
  readAsStringAsync: async () => "",
}));

mock.module("@noble/ed25519", () => ({
  etc: {},
  verifyAsync: async () => false,
}));

function base64UrlEncode(bytes: Uint8Array): string {
  return fromByteArray(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function licenseCodeFor(payload: Record<string, unknown>) {
  const payloadSegment = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signatureSegment = base64UrlEncode(new Uint8Array(64));
  return `LIC1.${payloadSegment}.${signatureSegment}`;
}

describe("pro license storage verification", () => {
  test("invalidates and removes stored licenses whose original signature fails verification", async () => {
    storage.clear();
    globalThis.fetch = (async () =>
      new Response(`public_key = "${base64UrlEncode(new Uint8Array(32))}"`, {
        status: 200,
      })) as typeof fetch;
    const { getProStatus } = await import("./pro");
    const payload = {
      v: 1,
      product: "vtt-pro",
      licId: "tampered",
      planDays: 30,
      iat: 1,
      exp: 9999999999,
      nonce: "nonce",
      deviceUid: "device-1",
      bindMode: "fixed",
    };

    storage.set(
      "agents.pro.license",
      JSON.stringify({
        code: licenseCodeFor(payload),
        payload,
        boundDeviceUid: "device-1",
        activatedAtTrustedMs: 1000,
      })
    );

    const status = await getProStatus();

    expect(status.reason).toBe("invalid");
    expect(status.isActive).toBe(false);
    expect(storage.has("agents.pro.license")).toBe(false);
  });
});
