import { describe, expect, test } from "bun:test";

import {
  addHistoryNode,
  countFolderDescendants,
  createEmptyHistoryTree,
  deleteHistoryNode,
  deriveNextFolderIdFromTree,
  deriveNextHistoryIdFromTree,
  getChildNodes,
  getFolderPath,
  isValidMove,
  migrateFlatConversations,
  moveHistoryNode,
  normalizeHistoryTree,
  sanitizeHistoryTree,
  searchHistoryTree,
  type HistoryConversation,
  type HistoryFolder,
} from "./history-tree";

const createAssistantId = (role: "user" | "assistant") => `${role}-fallback`;

function conversation(id: string, parentId: string | null = null): HistoryConversation {
  return {
    kind: "conversation",
    id,
    title: `Conversation ${id}`,
    transcript: id === "conv-2" ? "deep transcript" : "",
    summaryHidden: false,
    parentId,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    messages: [],
    assistantMessages: [],
    ttsMessages: [],
  };
}

function folder(id: string, parentId: string | null = null): HistoryFolder {
  return {
    kind: "folder",
    id,
    title: `Folder ${id}`,
    colorKey: "blue",
    parentId,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    updatedAt: Number(id.replace(/\D/g, "")) || 1,
  };
}

describe("history tree", () => {
  test("migrates v2 flat conversations into root nodes", () => {
    const tree = migrateFlatConversations(
      [
        {
          id: "conv-1",
          title: "Old conversation",
          transcript: "hello",
          createdAt: 10,
          messages: [],
        },
      ],
      createAssistantId
    );

    expect(tree.rootIds).toEqual(["conv-1"]);
    expect(tree.nodes["conv-1"]).toMatchObject({
      kind: "conversation",
      parentId: null,
      title: "Old conversation",
      transcript: "hello",
    });
  });

  test("creates folders and moves conversations in and out", () => {
    let tree = createEmptyHistoryTree();
    tree = addHistoryNode(tree, folder("folder-1"));
    tree = addHistoryNode(tree, conversation("conv-1"));

    tree = moveHistoryNode(tree, "conv-1", "folder-1");
    expect(tree.nodes["conv-1"].parentId).toBe("folder-1");
    expect(getChildNodes(tree, "folder-1").map((node) => node.id)).toEqual(["conv-1"]);

    tree = moveHistoryNode(tree, "conv-1", null);
    expect(tree.nodes["conv-1"].parentId).toBeNull();
    expect(tree.rootIds).toContain("conv-1");
  });

  test("supports nested folders and prevents moving a folder into its descendant", () => {
    let tree = createEmptyHistoryTree();
    tree = addHistoryNode(tree, folder("folder-1"));
    tree = addHistoryNode(tree, folder("folder-2", "folder-1"));
    tree = addHistoryNode(tree, conversation("conv-2", "folder-2"));

    expect(getFolderPath(tree, "folder-2").map((item) => item.id)).toEqual([
      "folder-1",
      "folder-2",
    ]);
    expect(isValidMove(tree, "folder-1", "folder-2")).toBe(false);

    const unchanged = moveHistoryNode(tree, "folder-1", "folder-2");
    expect(unchanged.nodes["folder-1"].parentId).toBeNull();
  });

  test("searches globally and returns folder paths", () => {
    let tree = createEmptyHistoryTree();
    tree = addHistoryNode(tree, folder("folder-1"));
    tree = addHistoryNode(tree, folder("folder-2", "folder-1"));
    tree = addHistoryNode(tree, conversation("conv-2", "folder-2"));

    const results = searchHistoryTree(tree, "deep transcript");
    expect(results).toHaveLength(1);
    expect(results[0].node.id).toBe("conv-2");
    expect(results[0].path.map((item) => item.id)).toEqual(["folder-1", "folder-2"]);
  });

  test("counts descendants and derives counters", () => {
    let tree = createEmptyHistoryTree();
    tree = addHistoryNode(tree, folder("folder-4"));
    tree = addHistoryNode(tree, folder("folder-5", "folder-4"));
    tree = addHistoryNode(tree, conversation("conv-7", "folder-5"));

    expect(countFolderDescendants(tree, "folder-4")).toEqual({
      folders: 1,
      conversations: 1,
    });
    expect(deriveNextFolderIdFromTree(tree)).toBe(6);
    expect(deriveNextHistoryIdFromTree(tree)).toBe(8);
  });

  test("deletes nested folders and conversations as a cascade", () => {
    let tree = createEmptyHistoryTree();
    tree = addHistoryNode(tree, folder("folder-1"));
    tree = addHistoryNode(tree, folder("folder-2", "folder-1"));
    tree = addHistoryNode(tree, conversation("conv-3", "folder-2"));

    const deleted = deleteHistoryNode(tree, "folder-1");

    expect(Object.keys(deleted.nodes)).toEqual([]);
    expect(deleted.rootIds).toEqual([]);
  });

  test("drops malformed messages while sanitizing conversations", () => {
    const tree = sanitizeHistoryTree(
      {
        nodes: {
          "conv-1": {
            ...conversation("conv-1"),
            messages: [
              {
                id: 1,
                title: "Valid",
                status: "completed",
                translationStatus: "idle",
                createdAt: 1,
                updatedAt: 1,
              },
              {
                id: "bad",
                title: "Invalid",
                status: "completed",
                createdAt: 1,
                updatedAt: 1,
              },
            ],
          },
        },
        rootIds: ["conv-1"],
      },
      createAssistantId
    );

    expect((tree.nodes["conv-1"] as HistoryConversation).messages).toHaveLength(1);
  });

  test("normalizes conversations whose parent points at a conversation", () => {
    const tree = normalizeHistoryTree({
      nodes: {
        "conv-1": conversation("conv-1"),
        "conv-2": conversation("conv-2", "conv-1"),
      },
      rootIds: ["conv-1"],
    });

    expect(tree.nodes["conv-2"].parentId).toBeNull();
    expect(tree.rootIds).toContain("conv-2");
  });
});
