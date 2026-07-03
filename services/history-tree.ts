import type { TranscriptionMessage } from "@/types/transcription";
import type { TtsMessage } from "@/types/tts";

export type AssistantMessageStatus = "pending" | "succeeded" | "failed";

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status: AssistantMessageStatus;
  error?: string;
};

export type HistoryFolderColorKey =
  | "blue"
  | "green"
  | "orange"
  | "pink"
  | "purple"
  | "slate";

export type HistoryFolder = {
  kind: "folder";
  id: string;
  title: string;
  colorKey: HistoryFolderColorKey;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type HistoryConversation = {
  kind: "conversation";
  id: string;
  title: string;
  transcript: string;
  translation?: string;
  summary?: string;
  summaryHidden: boolean;
  parentId: string | null;
  createdAt: number;
  messages: TranscriptionMessage[];
  assistantMessages: AssistantMessage[];
  ttsMessages: TtsMessage[];
};

export type HistoryNode = HistoryConversation | HistoryFolder;
export type HistoryNodeMap = Record<string, HistoryNode>;

export type HistoryTreeState = {
  nodes: HistoryNodeMap;
  rootIds: string[];
};

export type StoredHistoryPayloadV3 = HistoryTreeState & {
  version?: number;
  activeConversationId?: string | null;
  activeFolderId?: string | null;
  nextIdCounter?: number;
  nextFolderIdCounter?: number;
};

export type HistorySearchResult = {
  node: HistoryNode;
  path: HistoryFolder[];
};

const FALLBACK_FOLDER_COLOR: HistoryFolderColorKey = "blue";
const FOLDER_COLOR_KEYS = new Set<HistoryFolderColorKey>([
  "blue",
  "green",
  "orange",
  "pink",
  "purple",
  "slate",
]);

export function createEmptyHistoryTree(): HistoryTreeState {
  return {
    nodes: {},
    rootIds: [],
  };
}

export function sanitizeAssistantMessages(
  raw: unknown,
  createId: (role: "user" | "assistant") => string
): AssistantMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const sanitized: AssistantMessage[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const candidate = item as Partial<AssistantMessage>;
    if (candidate.role !== "user" && candidate.role !== "assistant") {
      return;
    }
    const textContent = typeof candidate.content === "string" ? candidate.content.trim() : "";
    if (!textContent) {
      return;
    }
    const status: AssistantMessageStatus =
      candidate.status === "failed" || candidate.status === "pending"
        ? candidate.status
        : "succeeded";

    sanitized.push({
      id:
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id
          : createId(candidate.role),
      role: candidate.role,
      content: textContent,
      createdAt:
        typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
          ? candidate.createdAt
          : Date.now(),
      status,
      error:
        typeof candidate.error === "string" && candidate.error.trim()
          ? candidate.error.trim()
          : undefined,
    });
  });
  return sanitized;
}

export function sanitizeHistoryConversation(
  raw: unknown,
  createAssistantId: (role: "user" | "assistant") => string,
  parentId: string | null = null
): HistoryConversation | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Partial<HistoryConversation>;
  if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
    return null;
  }
  return {
    kind: "conversation",
    id: candidate.id,
    title: candidate.title,
    transcript: typeof candidate.transcript === "string" ? candidate.transcript : "",
    translation: typeof candidate.translation === "string" ? candidate.translation : undefined,
    summary: typeof candidate.summary === "string" ? candidate.summary : undefined,
    summaryHidden: candidate.summaryHidden === true,
    parentId:
      typeof candidate.parentId === "string" && candidate.parentId.trim()
        ? candidate.parentId
        : parentId,
    createdAt:
      typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : Date.now(),
    messages: Array.isArray(candidate.messages)
      ? candidate.messages
          .filter(
            (message): message is TranscriptionMessage =>
              !!message && typeof message === "object"
          )
          .map((message) => ({ ...message }))
      : [],
    assistantMessages: sanitizeAssistantMessages(candidate.assistantMessages, createAssistantId),
    ttsMessages: Array.isArray(candidate.ttsMessages)
      ? candidate.ttsMessages
          .filter((message): message is TtsMessage => !!message && typeof message === "object")
          .map((message) => ({ ...message }))
      : [],
  };
}

export function sanitizeHistoryFolder(raw: unknown, parentId: string | null = null): HistoryFolder | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Partial<HistoryFolder>;
  if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
    return null;
  }
  const colorKey = candidate.colorKey;
  const now = Date.now();
  return {
    kind: "folder",
    id: candidate.id,
    title: candidate.title,
    colorKey: colorKey && FOLDER_COLOR_KEYS.has(colorKey) ? colorKey : FALLBACK_FOLDER_COLOR,
    parentId:
      typeof candidate.parentId === "string" && candidate.parentId.trim()
        ? candidate.parentId
        : parentId,
    createdAt:
      typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : now,
    updatedAt:
      typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : now,
  };
}

export function sanitizeHistoryTree(
  raw: unknown,
  createAssistantId: (role: "user" | "assistant") => string
): HistoryTreeState {
  if (Array.isArray(raw)) {
    return migrateFlatConversations(raw, createAssistantId);
  }
  if (!raw || typeof raw !== "object") {
    return createEmptyHistoryTree();
  }
  const payload = raw as { nodes?: unknown; rootIds?: unknown; conversations?: unknown };
  if (payload.nodes && typeof payload.nodes === "object" && !Array.isArray(payload.nodes)) {
    const nodes: HistoryNodeMap = {};
    Object.values(payload.nodes as Record<string, unknown>).forEach((item) => {
      const kind = item && typeof item === "object" ? (item as Partial<HistoryNode>).kind : undefined;
      const node =
        kind === "folder"
          ? sanitizeHistoryFolder(item)
          : sanitizeHistoryConversation(item, createAssistantId);
      if (node) {
        nodes[node.id] = node;
      }
    });
    return normalizeHistoryTree({
      nodes,
      rootIds: Array.isArray(payload.rootIds)
        ? payload.rootIds.filter((id): id is string => typeof id === "string")
        : [],
    });
  }
  return migrateFlatConversations(payload.conversations ?? [], createAssistantId);
}

export function migrateFlatConversations(
  raw: unknown,
  createAssistantId: (role: "user" | "assistant") => string
): HistoryTreeState {
  if (!Array.isArray(raw)) {
    return createEmptyHistoryTree();
  }
  const nodes: HistoryNodeMap = {};
  const rootIds: string[] = [];
  raw.forEach((item) => {
    const conversation = sanitizeHistoryConversation(item, createAssistantId, null);
    if (!conversation || nodes[conversation.id]) {
      return;
    }
    nodes[conversation.id] = conversation;
    rootIds.push(conversation.id);
  });
  return { nodes, rootIds };
}

export function normalizeHistoryTree(tree: HistoryTreeState): HistoryTreeState {
  const nodes: HistoryNodeMap = {};
  Object.values(tree.nodes).forEach((node) => {
    nodes[node.id] = { ...node };
  });

  Object.values(nodes).forEach((node) => {
    if (node.parentId && !nodes[node.parentId]) {
      node.parentId = null;
    }
    if (node.kind === "folder" && node.parentId && isDescendantOf(nodes, node.parentId, node.id)) {
      node.parentId = null;
    }
  });

  const rootIds = uniqueIds([
    ...tree.rootIds.filter((id) => nodes[id] && nodes[id].parentId === null),
    ...Object.values(nodes)
      .filter((node) => node.parentId === null)
      .map((node) => node.id),
  ]);

  return { nodes, rootIds };
}

export function getHistoryNode(tree: HistoryTreeState, id: string | null | undefined): HistoryNode | null {
  return id ? tree.nodes[id] ?? null : null;
}

export function getHistoryConversation(
  tree: HistoryTreeState,
  id: string | null | undefined
): HistoryConversation | null {
  const node = getHistoryNode(tree, id);
  return node?.kind === "conversation" ? node : null;
}

export function getHistoryFolder(
  tree: HistoryTreeState,
  id: string | null | undefined
): HistoryFolder | null {
  const node = getHistoryNode(tree, id);
  return node?.kind === "folder" ? node : null;
}

export function getChildNodes(tree: HistoryTreeState, parentId: string | null): HistoryNode[] {
  const ids =
    parentId === null
      ? tree.rootIds
      : Object.values(tree.nodes)
          .filter((node) => node.parentId === parentId)
          .map((node) => node.id);
  return uniqueIds(ids)
    .map((id) => tree.nodes[id])
    .filter((node): node is HistoryNode => Boolean(node))
    .filter((node) => node.parentId === parentId);
}

export function getFolderPath(tree: HistoryTreeState, folderId: string | null): HistoryFolder[] {
  const path: HistoryFolder[] = [];
  const seen = new Set<string>();
  let currentId = folderId;
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const folder = getHistoryFolder(tree, currentId);
    if (!folder) {
      break;
    }
    path.unshift(folder);
    currentId = folder.parentId;
  }
  return path;
}

export function getNodePath(tree: HistoryTreeState, node: HistoryNode): HistoryFolder[] {
  return getFolderPath(tree, node.parentId);
}

export function moveHistoryNode(
  tree: HistoryTreeState,
  nodeId: string,
  nextParentId: string | null
): HistoryTreeState {
  const node = tree.nodes[nodeId];
  if (!node || node.parentId === nextParentId) {
    return tree;
  }
  if (nextParentId && tree.nodes[nextParentId]?.kind !== "folder") {
    return tree;
  }
  if (node.kind === "folder" && nextParentId && (node.id === nextParentId || isDescendantOf(tree.nodes, nextParentId, node.id))) {
    return tree;
  }

  const nodes: HistoryNodeMap = {
    ...tree.nodes,
    [node.id]: { ...node, parentId: nextParentId },
  };
  const rootIds =
    nextParentId === null
      ? uniqueIds([...tree.rootIds.filter((id) => id !== node.id), node.id])
      : tree.rootIds.filter((id) => id !== node.id);

  return normalizeHistoryTree({ nodes, rootIds });
}

export function updateHistoryNode(tree: HistoryTreeState, node: HistoryNode): HistoryTreeState {
  if (!tree.nodes[node.id]) {
    return tree;
  }
  return normalizeHistoryTree({
    ...tree,
    nodes: {
      ...tree.nodes,
      [node.id]: node,
    },
  });
}

export function addHistoryNode(tree: HistoryTreeState, node: HistoryNode): HistoryTreeState {
  return normalizeHistoryTree({
    nodes: {
      ...tree.nodes,
      [node.id]: node,
    },
    rootIds: node.parentId === null ? uniqueIds([node.id, ...tree.rootIds]) : tree.rootIds,
  });
}

export function deleteHistoryNode(tree: HistoryTreeState, nodeId: string): HistoryTreeState {
  const idsToDelete = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    Object.values(tree.nodes).forEach((node) => {
      if (node.parentId && idsToDelete.has(node.parentId) && !idsToDelete.has(node.id)) {
        idsToDelete.add(node.id);
        changed = true;
      }
    });
  }
  const nodes: HistoryNodeMap = {};
  Object.values(tree.nodes).forEach((node) => {
    if (!idsToDelete.has(node.id)) {
      nodes[node.id] = node;
    }
  });
  return normalizeHistoryTree({
    nodes,
    rootIds: tree.rootIds.filter((id) => !idsToDelete.has(id)),
  });
}

export function countFolderDescendants(tree: HistoryTreeState, folderId: string): {
  folders: number;
  conversations: number;
} {
  let folders = 0;
  let conversations = 0;
  Object.values(tree.nodes).forEach((node) => {
    if (node.id === folderId) {
      return;
    }
    if (!isDescendantOf(tree.nodes, node.id, folderId)) {
      return;
    }
    if (node.kind === "folder") {
      folders += 1;
    } else {
      conversations += 1;
    }
  });
  return { folders, conversations };
}

export function searchHistoryTree(tree: HistoryTreeState, keyword: string): HistorySearchResult[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  return Object.values(tree.nodes)
    .filter((node) => {
      if (node.kind === "folder") {
        return node.title.toLowerCase().includes(normalized);
      }
      const haystack = `${node.title} ${node.transcript} ${node.translation ?? ""} ${node.summary ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    })
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "folder" ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    })
    .map((node) => ({
      node,
      path: getNodePath(tree, node),
    }));
}

export function deriveNextHistoryIdFromTree(tree: HistoryTreeState, fallback: number = 1): number {
  return deriveNextCounter(Object.keys(tree.nodes), "conv-", fallback);
}

export function deriveNextFolderIdFromTree(tree: HistoryTreeState, fallback: number = 1): number {
  return deriveNextCounter(Object.keys(tree.nodes), "folder-", fallback);
}

export function isConversationEmpty(conversation: HistoryConversation): boolean {
  const hasTranscript = conversation.transcript.trim().length > 0;
  const hasTranslation =
    typeof conversation.translation === "string" && conversation.translation.trim().length > 0;
  const hasSummary = typeof conversation.summary === "string" && conversation.summary.trim().length > 0;
  return !(
    hasTranscript ||
    hasTranslation ||
    hasSummary ||
    conversation.messages.length > 0 ||
    conversation.assistantMessages.length > 0 ||
    conversation.ttsMessages.length > 0
  );
}

export function isValidMove(tree: HistoryTreeState, nodeId: string, nextParentId: string | null): boolean {
  const node = tree.nodes[nodeId];
  if (!node) {
    return false;
  }
  if (nextParentId === null) {
    return true;
  }
  if (tree.nodes[nextParentId]?.kind !== "folder") {
    return false;
  }
  return node.kind !== "folder" || (node.id !== nextParentId && !isDescendantOf(tree.nodes, nextParentId, node.id));
}

function isDescendantOf(nodes: HistoryNodeMap, nodeId: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  let current = nodes[nodeId];
  while (current?.parentId && !seen.has(current.parentId)) {
    if (current.parentId === ancestorId) {
      return true;
    }
    seen.add(current.parentId);
    current = nodes[current.parentId];
  }
  return false;
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function deriveNextCounter(ids: string[], prefix: string, fallback: number): number {
  let next = Math.max(fallback, 1);
  ids.forEach((id) => {
    if (!id.startsWith(prefix)) {
      return;
    }
    const numeric = Number.parseInt(id.slice(prefix.length), 10);
    if (!Number.isNaN(numeric)) {
      next = Math.max(next, numeric + 1);
    }
  });
  return next;
}
