/**
 * Chat history over the internal `batchexecute` RPC API.
 *
 * NotebookLM keeps every answer it has ever given in a notebook, and until now
 * nothing here could read it back: an agent that asked a question in an earlier
 * run had to ask it again. These three calls expose that history and the "clear
 * history" button beside it.
 *
 * Payload shapes and envelope positions read from teng-lin/notebooklm-py (MIT,
 * `_web/chat.py` and `_web/rows/chat.py`); the implementation is our own.
 */

import { BatchExecuteClient } from './batchexecute.js';

/** Role code carried at index 2 of a turn row. */
const ROLE_QUESTION = 1;
const ROLE_ANSWER = 2;

/** One exchange in a notebook's chat history. */
export interface ChatTurn {
  role: 'question' | 'answer';
  text: string;
}

export class ChatRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /**
   * The id of the notebook's most recent conversation, or `null` when nothing
   * has been asked yet.
   *
   * The RPC takes a limit and ignores it — the server always answers with
   * exactly one id. There is no way to list older conversations, so this is
   * deliberately named for what it returns rather than for what the backlog
   * entry hoped it would.
   */
  async getLastConversationId(notebookId: string): Promise<string | null> {
    const result = (await this.client.call(
      'GET_CONVERSATIONS',
      [[], null, notebookId, 1],
      `/notebook/${notebookId}`
    )) as unknown;

    if (!Array.isArray(result)) return null;
    for (const group of result) {
      if (!Array.isArray(group)) continue;
      for (const row of group) {
        if (Array.isArray(row) && typeof row[0] === 'string') return row[0];
      }
    }
    return null;
  }

  /**
   * The turns of one conversation, **newest first** — so a limit of 2 is the
   * latest question and its answer.
   *
   * A turn row is `[…, role, question, answerContent]`: role 1 carries its text
   * at index 3, role 2 at `[4][0][0]`. Rows we cannot classify are skipped
   * rather than guessed at.
   */
  async getTurns(notebookId: string, conversationId: string, limit = 20): Promise<ChatTurn[]> {
    const result = (await this.client.call(
      'GET_CONVERSATION_TURNS',
      [[], null, null, conversationId, limit],
      `/notebook/${notebookId}`
    )) as unknown;

    const rows = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as unknown[]) : [];
    const turns: ChatTurn[] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 3) continue;
      if (row[2] === ROLE_QUESTION) {
        if (typeof row[3] === 'string') turns.push({ role: 'question', text: row[3] });
        continue;
      }
      if (row[2] === ROLE_ANSWER) {
        const block = Array.isArray(row[4]) ? (row[4] as unknown[])[0] : undefined;
        const text = Array.isArray(block) ? block[0] : undefined;
        if (typeof text === 'string') turns.push({ role: 'answer', text });
      }
    }
    return turns;
  }

  /**
   * Delete a conversation server-side — the web UI's "Delete history".
   *
   * There is no per-turn delete: the whole history goes. Afterwards the next
   * question with no conversation id starts a fresh conversation instead of
   * extending the deleted one. Success is an empty reply.
   */
  async deleteConversation(notebookId: string, conversationId: string): Promise<void> {
    await this.client.call(
      'DELETE_CHAT_HISTORY',
      [[], conversationId, null, 1],
      `/notebook/${notebookId}`
    );
  }

  /**
   * Cancel the active answer generation for a conversation — the web UI's
   * "Stop" during a streaming answer.
   *
   * Fire-and-forget and idempotent: the server stops the running turn and
   * replies empty whether or not a turn was in flight, so there is no success
   * signal to read. Cancelling a conversation that is not generating is a
   * silent no-op. The only way to confirm is to re-read the conversation.
   */
  async cancelGeneration(notebookId: string, conversationId: string): Promise<void> {
    await this.client.call('CANCEL_GENERATION', [null, conversationId], `/notebook/${notebookId}`);
  }
}
