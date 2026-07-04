import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  deriveNextFolderIdFromTree,
  deriveNextHistoryIdFromTree,
  normalizeHistoryTree,
  sanitizeHistoryTree,
  type HistoryTreeState,
  type StoredHistoryPayloadV3,
} from "@/services/history-tree";

export const HISTORY_STORAGE_KEY = "@agents/history-conversations";
export const HISTORY_STORAGE_BACKUP_KEY = `${HISTORY_STORAGE_KEY}.bak`;
export const HISTORY_STORAGE_VERSION = 3;

type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type HistoryStorageLoadResult = {
  tree: HistoryTreeState;
  activeConversationId: string | null;
  activeFolderId: string | null;
  nextIdCounter: number;
  nextFolderIdCounter: number;
  loadFailed: boolean;
  readOnly: boolean;
  recoveredFromBackup: boolean;
};

type ParseResult = {
  parsed: unknown;
  raw: string;
  recoveredFromBackup: boolean;
};

function createAssistantMessageId(role: "user" | "assistant"): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isObjectPayload(value: unknown): value is Partial<StoredHistoryPayloadV3> & {
  version?: unknown;
} {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function parseStoredHistory(storage: StorageLike): Promise<ParseResult | null> {
  let raw: string | null = null;
  try {
    raw = await storage.getItem(HISTORY_STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw) {
    try {
      return { parsed: JSON.parse(raw) as unknown, raw, recoveredFromBackup: false };
    } catch {
      // Try backup below.
    }
  }

  const backupRaw = await storage.getItem(HISTORY_STORAGE_BACKUP_KEY);
  if (!backupRaw) {
    return raw ? null : { parsed: null, raw: "", recoveredFromBackup: false };
  }
  return { parsed: JSON.parse(backupRaw) as unknown, raw: backupRaw, recoveredFromBackup: true };
}

export async function loadHistoryStorage(
  storage: StorageLike = AsyncStorage
): Promise<HistoryStorageLoadResult> {
  let result: ParseResult | null;
  try {
    result = await parseStoredHistory(storage);
  } catch {
    return {
      tree: { nodes: {}, rootIds: [] },
      activeConversationId: null,
      activeFolderId: null,
      nextIdCounter: 1,
      nextFolderIdCounter: 1,
      loadFailed: true,
      readOnly: true,
      recoveredFromBackup: false,
    };
  }

  if (!result) {
    return {
      tree: { nodes: {}, rootIds: [] },
      activeConversationId: null,
      activeFolderId: null,
      nextIdCounter: 1,
      nextFolderIdCounter: 1,
      loadFailed: true,
      readOnly: true,
      recoveredFromBackup: false,
    };
  }

  if (result.parsed === null) {
    return {
      tree: { nodes: {}, rootIds: [] },
      activeConversationId: null,
      activeFolderId: null,
      nextIdCounter: 1,
      nextFolderIdCounter: 1,
      loadFailed: false,
      readOnly: false,
      recoveredFromBackup: false,
    };
  }

  const payload = isObjectPayload(result.parsed) ? result.parsed : {};
  const version = typeof payload.version === "number" ? payload.version : undefined;
  const readOnly = typeof version === "number" && version > HISTORY_STORAGE_VERSION;
  const tree = normalizeHistoryTree(sanitizeHistoryTree(result.parsed, createAssistantMessageId));
  const nextIdCounter =
    typeof payload.nextIdCounter === "number" && payload.nextIdCounter > 0
      ? Math.max(payload.nextIdCounter, deriveNextHistoryIdFromTree(tree, 1))
      : deriveNextHistoryIdFromTree(tree, 1);
  const nextFolderIdCounter =
    typeof payload.nextFolderIdCounter === "number" && payload.nextFolderIdCounter > 0
      ? Math.max(payload.nextFolderIdCounter, deriveNextFolderIdFromTree(tree, 1))
      : deriveNextFolderIdFromTree(tree, 1);
  const activeConversationId =
    typeof payload.activeConversationId === "string" && tree.nodes[payload.activeConversationId]?.kind === "conversation"
      ? payload.activeConversationId
      : null;
  const activeFolderId =
    typeof payload.activeFolderId === "string" && tree.nodes[payload.activeFolderId]?.kind === "folder"
      ? payload.activeFolderId
      : null;

  if (!result.recoveredFromBackup && result.raw) {
    await storage.setItem(HISTORY_STORAGE_BACKUP_KEY, result.raw).catch(() => undefined);
  }

  if (result.recoveredFromBackup && !readOnly) {
    await persistHistoryStorage(
      {
        tree,
        activeConversationId,
        activeFolderId,
        nextIdCounter,
        nextFolderIdCounter,
      },
      { storage }
    );
  }

  return {
    tree,
    activeConversationId,
    activeFolderId,
    nextIdCounter,
    nextFolderIdCounter,
    loadFailed: false,
    readOnly,
    recoveredFromBackup: result.recoveredFromBackup,
  };
}

export async function persistHistoryStorage(
  payload: {
    tree: HistoryTreeState;
    activeConversationId: string | null;
    activeFolderId: string | null;
    nextIdCounter: number;
    nextFolderIdCounter: number;
  },
  options?: {
    storage?: StorageLike;
    disabled?: boolean;
  }
): Promise<boolean> {
  if (options?.disabled) {
    return false;
  }
  const storage = options?.storage ?? AsyncStorage;
  const stored: StoredHistoryPayloadV3 = {
    version: HISTORY_STORAGE_VERSION,
    nodes: payload.tree.nodes,
    rootIds: payload.tree.rootIds,
    activeConversationId: payload.activeConversationId,
    activeFolderId: payload.activeFolderId,
    nextIdCounter: payload.nextIdCounter,
    nextFolderIdCounter: payload.nextFolderIdCounter,
  };
  await storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(stored));
  return true;
}
