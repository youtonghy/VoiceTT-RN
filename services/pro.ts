import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ed25519 from '@noble/ed25519';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils';
import { toByteArray, fromByteArray } from 'base64-js';

function normalizeBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') {
    return utf8ToBytes(value);
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  throw new Error('Invalid byte input');
}

function ensureBytes(value: unknown, label: string, expectedLength?: number): Uint8Array {
  const bytes = normalizeBytes(value);
  const normalized = Uint8Array.from(bytes);
  if (typeof expectedLength === 'number' && normalized.length !== expectedLength) {
    throw new Error(`${label} length mismatch (${normalized.length})`);
  }
  return normalized;
}

async function useSecureStore(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  if (cachedSecureStoreAvailable !== null) {
    return cachedSecureStoreAvailable;
  }
  try {
    cachedSecureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch {
    cachedSecureStoreAvailable = false;
  }
  return cachedSecureStoreAvailable;
}

async function storageGet(key: string): Promise<string | null> {
  if (await useSecureStore()) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (await useSecureStore()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function storageDelete(key: string): Promise<void> {
  if (await useSecureStore()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

ed25519.etc.sha512Async = async (...messages) => {
  const data = concatBytes(...messages.map((item) => ensureBytes(item, 'sha512 input')));
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA512, data);
  return new Uint8Array(digest);
};

const LICENSE_PREFIX = 'LIC1';
const PRODUCT_ID = 'vtt-pro';
const ALLOWED_DAYS = new Set([7, 30, 90, 365]);

const DEVICE_UID_KEY = 'agents.pro.device_uid';
const LICENSE_KEY = 'agents.pro.license';
const TRUSTED_TIME_KEY = 'agents.pro.trusted_time';

const MAX_TRUSTED_AGE_MS = 1000 * 60 * 60 * 24 * 3;
const ALLOWED_BACKWARD_SKEW_MS = 1000 * 60;

const TIME_ENDPOINTS = [
  'https://worldtimeapi.org/api/timezone/Etc/UTC',
  'https://worldtimeapi.org/api/ip',
];

const PUBLIC_KEY_TOML_ASSET = require('../pro-public.toml');
let cachedPublicKey: Uint8Array | null = null;
let cachedPublicKeyError: Error | null = null;
let cachedSecureStoreAvailable: boolean | null = null;

export type LicensePayload = {
  v: number;
  product: string;
  licId: string;
  planDays: number;
  iat: number;
  exp: number;
  nonce: string;
  deviceUid?: string | null;
  bindMode?: 'fixed' | 'first_use';
  isLifetime?: boolean;
};

type StoredLicense = {
  code: string;
  payload: LicensePayload;
  boundDeviceUid?: string;
  activatedAtTrustedMs: number;
};

type TrustedTimeState = {
  serverTimeMs: number;
  deviceTimeMs: number;
  updatedAtMs: number;
  source: 'https';
};

export type ProStatusReason =
  | 'active'
  | 'no_license'
  | 'expired'
  | 'needs_time_sync'
  | 'time_rollback'
  | 'device_mismatch'
  | 'invalid'
  | 'not_active_yet';

export type ProStatus = {
  isActive: boolean;
  reason: ProStatusReason;
  payload?: LicensePayload;
  expiresAtMs?: number;
  trustedNowMs?: number;
  boundDeviceUid?: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  return fromByteArray(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const pad = value.length % 4 ? '='.repeat(4 - (value.length % 4)) : '';
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return normalizeBytes(toByteArray(base64));
}

function parseLicense(code: string) {
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) {
    throw new Error('Invalid license format');
  }
  return {
    payloadSegment: parts[1],
    signatureSegment: parts[2],
  };
}

function parsePayload(payloadSegment: string): LicensePayload {
  const payloadBytes = base64UrlToBytes(payloadSegment);
  const json = new TextDecoder().decode(payloadBytes);
  return JSON.parse(json) as LicensePayload;
}

function validatePayload(payload: LicensePayload) {
  const isLifetime = payload.isLifetime === true || payload.exp === 0;
  if (payload.v !== 1) {
    throw new Error('Unsupported license version');
  }
  if (payload.product !== PRODUCT_ID) {
    throw new Error('Invalid product');
  }
  if (!payload.deviceUid || typeof payload.deviceUid !== 'string') {
    throw new Error('Device binding required');
  }
  if (!isLifetime && !ALLOWED_DAYS.has(payload.planDays)) {
    throw new Error('Invalid plan duration');
  }
  if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) {
    throw new Error('Invalid license timing');
  }
  if (!isLifetime && payload.exp <= payload.iat) {
    throw new Error('Invalid license timing');
  }
}

async function verifySignature(payloadSegment: string, signatureSegment: string) {
  const publicKey = ensureBytes(await getPublicKeyBytes(), 'public key', 32);
  const signature = ensureBytes(base64UrlToBytes(signatureSegment), 'signature', 64);
  const message = ensureBytes(utf8ToBytes(payloadSegment), 'message');
  const ok = await ed25519.verifyAsync(signature, message, publicKey);
  if (!ok) {
    throw new Error('Signature verification failed');
  }
}

async function readPublicKeyToml(): Promise<string> {
  const asset = Asset.fromModule(PUBLIC_KEY_TOML_ASSET);
  if (!asset.localUri) {
    await asset.downloadAsync();
  }
  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error('Missing public key asset URI');
  }
  if (uri.startsWith('http') || Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error('Failed to load public key');
    }
    return await response.text();
  }
  if (typeof FileSystem.readAsStringAsync !== 'function') {
    throw new Error('FileSystem.readAsStringAsync is unavailable. Install expo-file-system.');
  }
  const encoding = FileSystem.EncodingType?.UTF8 ?? 'utf8';
  return await FileSystem.readAsStringAsync(uri, { encoding });
}

function parsePublicKeyFromToml(content: string): string {
  const match = content.match(/^\s*public_key\s*=\s*["']([^"']+)["']/m);
  if (!match) {
    throw new Error('Missing public_key in pro-public.toml');
  }
  return match[1].trim();
}

function normalizePublicKeyBytes(keyBytes: Uint8Array): Uint8Array {
  if (keyBytes.length === 32) {
    return keyBytes;
  }
  const spkiPrefix = Uint8Array.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
  if (keyBytes.length === 44 && spkiPrefix.every((value, index) => keyBytes[index] === value)) {
    return keyBytes.slice(spkiPrefix.length);
  }
  throw new Error('Invalid public key format');
}

async function getPublicKeyBytes(): Promise<Uint8Array> {
  if (cachedPublicKey) {
    cachedPublicKey = normalizePublicKeyBytes(cachedPublicKey);
    return cachedPublicKey;
  }
  if (cachedPublicKeyError) {
    throw cachedPublicKeyError;
  }
  try {
    const content = await readPublicKeyToml();
    const keyBase64Url = parsePublicKeyFromToml(content);
    cachedPublicKey = normalizePublicKeyBytes(base64UrlToBytes(keyBase64Url));
    return cachedPublicKey;
  } catch (error) {
    cachedPublicKeyError = error instanceof Error ? error : new Error(String(error));
    throw cachedPublicKeyError;
  }
}

async function fetchTrustedTimeMs(): Promise<number> {
  for (const url of TIME_ENDPOINTS) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      const data = (await response.json()) as { unixtime?: number; datetime?: string; utc_datetime?: string };
      if (typeof data.unixtime === 'number') {
        return data.unixtime * 1000;
      }
      const iso = data.utc_datetime ?? data.datetime;
      if (typeof iso === 'string') {
        const parsed = Date.parse(iso);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Try next endpoint.
    }
  }
  throw new Error('Unable to fetch trusted time');
}

async function loadTrustedTime(): Promise<TrustedTimeState | null> {
  const raw = await storageGet(TRUSTED_TIME_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as TrustedTimeState;
  } catch {
    return null;
  }
}

async function saveTrustedTime(state: TrustedTimeState) {
  await storageSet(TRUSTED_TIME_KEY, JSON.stringify(state));
}

export async function syncTrustedTime(): Promise<number> {
  const serverTimeMs = await fetchTrustedTimeMs();
  const deviceTimeMs = Date.now();
  await saveTrustedTime({
    serverTimeMs,
    deviceTimeMs,
    updatedAtMs: deviceTimeMs,
    source: 'https',
  });
  return serverTimeMs;
}

async function trustedNowFromCache(): Promise<number> {
  const state = await loadTrustedTime();
  if (!state) {
    throw new Error('NO_TRUSTED_TIME');
  }
  const localNow = Date.now();
  if (localNow + ALLOWED_BACKWARD_SKEW_MS < state.deviceTimeMs) {
    throw new Error('TIME_ROLLBACK');
  }
  const age = localNow - state.deviceTimeMs;
  if (age > MAX_TRUSTED_AGE_MS) {
    throw new Error('TRUSTED_TIME_STALE');
  }
  return state.serverTimeMs + age;
}

export async function getDeviceUid(): Promise<string> {
  const existing = await storageGet(DEVICE_UID_KEY);
  if (existing) {
    return existing;
  }
  const bytes = await Crypto.getRandomBytesAsync(16);
  const uid = base64UrlEncode(bytes);
  await storageSet(DEVICE_UID_KEY, uid);
  return uid;
}

export async function activateProLicense(code: string): Promise<StoredLicense> {
  const deviceUid = await getDeviceUid();
  const trustedNow = await trustedNowFromCache();

  const { payloadSegment, signatureSegment } = parseLicense(code);
  await verifySignature(payloadSegment, signatureSegment);
  const payload = parsePayload(payloadSegment);
  validatePayload(payload);

  const isLifetime = payload.isLifetime === true || payload.exp === 0;
  const expMs = isLifetime ? null : payload.exp * 1000;
  const iatMs = payload.iat * 1000;
  if (!isLifetime && trustedNow + 1000 < iatMs) {
    throw new Error('NOT_ACTIVE_YET');
  }
  if (!isLifetime && expMs !== null && trustedNow > expMs) {
    throw new Error('LICENSE_EXPIRED');
  }
  if (payload.deviceUid !== deviceUid) {
    throw new Error('DEVICE_MISMATCH');
  }

  const stored: StoredLicense = {
    code,
    payload,
    boundDeviceUid: payload.deviceUid,
    activatedAtTrustedMs: trustedNow,
  };
  await storageSet(LICENSE_KEY, JSON.stringify(stored));
  return stored;
}

export async function getStoredLicense(): Promise<StoredLicense | null> {
  const raw = await storageGet(LICENSE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredLicense;
  } catch {
    return null;
  }
}

export async function clearProLicense(): Promise<void> {
  await storageDelete(LICENSE_KEY);
}

export async function getProStatus(): Promise<ProStatus> {
  const stored = await getStoredLicense();
  if (!stored) {
    return { isActive: false, reason: 'no_license' };
  }
  try {
    validatePayload(stored.payload);
  } catch {
    return { isActive: false, reason: 'invalid', payload: stored.payload };
  }

  let trustedNow: number;
  try {
    trustedNow = await trustedNowFromCache();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'TIME_ROLLBACK') {
        return { isActive: false, reason: 'time_rollback', payload: stored.payload };
      }
      if (error.message === 'NO_TRUSTED_TIME' || error.message === 'TRUSTED_TIME_STALE') {
        return { isActive: false, reason: 'needs_time_sync', payload: stored.payload };
      }
    }
    return { isActive: false, reason: 'needs_time_sync', payload: stored.payload };
  }

  const isLifetime = stored.payload.isLifetime === true || stored.payload.exp === 0;
  const expMs = isLifetime ? null : stored.payload.exp * 1000;
  const iatMs = stored.payload.iat * 1000;
  if (!isLifetime && trustedNow + 1000 < iatMs) {
    return { isActive: false, reason: 'not_active_yet', payload: stored.payload, expiresAtMs: expMs ?? undefined };
  }
  if (!isLifetime && expMs !== null && trustedNow > expMs) {
    return { isActive: false, reason: 'expired', payload: stored.payload, expiresAtMs: expMs };
  }

  const deviceUid = await getDeviceUid();
  if (stored.payload.deviceUid !== deviceUid) {
    return { isActive: false, reason: 'device_mismatch', payload: stored.payload, expiresAtMs: expMs };
  }

  return {
    isActive: true,
    reason: 'active',
    payload: stored.payload,
    expiresAtMs: expMs ?? undefined,
    trustedNowMs: trustedNow,
    boundDeviceUid: stored.boundDeviceUid,
  };
}
