import { describe, expect, test } from "bun:test";

import {
  HISTORY_STORAGE_BACKUP_KEY,
  HISTORY_STORAGE_KEY,
  loadHistoryStorage,
  persistHistoryStorage,
} from "./history-storage";
import { addHistoryNode, createEmptyHistoryTree, type HistoryConversation } from "./history-tree";

class MemoryStorage {
  private values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function conversation(id: string): HistoryConversation {
  return {
    kind: "conversation",
    id,
    title: `Conversation ${id}`,
    transcript: `Transcript ${id}`,
    summaryHidden: false,
    parentId: null,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    messages: [],
    assistantMessages: [],
    ttsMessages: [],
  };
}

describe("history storage", () => {
  test("round-trips v3 history trees without dropping nodes", async () => {
    const storage = new MemoryStorage();
    const tree = addHistoryNode(createEmptyHistoryTree(), conversation("conv-3"));

    await persistHistoryStorage(
      {
        tree,
        activeConversationId: "conv-3",
        activeFolderId: null,
        nextIdCounter: 4,
        nextFolderIdCounter: 1,
      },
      { storage }
    );

    const loaded = await loadHistoryStorage(storage);

    expect(loaded.loadFailed).toBe(false);
    expect(loaded.readOnly).toBe(false);
    expect(loaded.activeConversationId).toBe("conv-3");
    expect(loaded.tree.rootIds).toEqual(["conv-3"]);
    expect(loaded.tree.nodes["conv-3"]).toMatchObject({
      kind: "conversation",
      transcript: "Transcript conv-3",
    });
  });

  test("migrates v2 flat payloads to v3 trees", async () => {
    const storage = new MemoryStorage();
    await storage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        conversations: [
          {
            id: "conv-2",
            title: "Legacy",
            transcript: "legacy transcript",
            createdAt: 2,
            messages: [],
          },
        ],
        activeConversationId: "conv-2",
        nextIdCounter: 3,
      })
    );

    const loaded = await loadHistoryStorage(storage);
    await persistHistoryStorage(
      {
        tree: loaded.tree,
        activeConversationId: loaded.activeConversationId,
        activeFolderId: loaded.activeFolderId,
        nextIdCounter: loaded.nextIdCounter,
        nextFolderIdCounter: loaded.nextFolderIdCounter,
      },
      { storage, disabled: loaded.loadFailed || loaded.readOnly }
    );
    const stored = JSON.parse((await storage.getItem(HISTORY_STORAGE_KEY)) ?? "{}");

    expect(loaded.tree.rootIds).toEqual(["conv-2"]);
    expect(loaded.tree.nodes["conv-2"]).toMatchObject({
      kind: "conversation",
      title: "Legacy",
    });
    expect(stored.version).toBe(3);
    expect(Boolean(stored.nodes["conv-2"])).toBe(true);
  });

  test("does not overwrite corrupted primary storage when no backup exists", async () => {
    const storage = new MemoryStorage();
    await storage.setItem(HISTORY_STORAGE_KEY, "{not json");

    const loaded = await loadHistoryStorage(storage);
    const persisted = await persistHistoryStorage(
      {
        tree: loaded.tree,
        activeConversationId: null,
        activeFolderId: null,
        nextIdCounter: 1,
        nextFolderIdCounter: 1,
      },
      { storage, disabled: loaded.loadFailed || loaded.readOnly }
    );

    expect(loaded.loadFailed).toBe(true);
    expect(loaded.readOnly).toBe(true);
    expect(persisted).toBe(false);
    expect(await storage.getItem(HISTORY_STORAGE_KEY)).toBe("{not json");
  });

  test("restores from backup when primary storage is corrupted", async () => {
    const storage = new MemoryStorage();
    await storage.setItem(HISTORY_STORAGE_KEY, "{not json");
    await storage.setItem(
      HISTORY_STORAGE_BACKUP_KEY,
      JSON.stringify({
        version: 3,
        nodes: {
          "conv-7": conversation("conv-7"),
        },
        rootIds: ["conv-7"],
        activeConversationId: "conv-7",
        activeFolderId: null,
        nextIdCounter: 8,
        nextFolderIdCounter: 1,
      })
    );

    const loaded = await loadHistoryStorage(storage);
    const primary = JSON.parse((await storage.getItem(HISTORY_STORAGE_KEY)) ?? "{}");

    expect(loaded.loadFailed).toBe(false);
    expect(loaded.recoveredFromBackup).toBe(true);
    expect(loaded.activeConversationId).toBe("conv-7");
    expect(Boolean(primary.nodes["conv-7"])).toBe(true);
  });
});
