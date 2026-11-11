/**
 * Unit tests for the chat-history envelopes (no network).
 *
 * The three calls are positional and undocumented by Google. These lock what
 * would otherwise break silently against a live notebook: which slot the
 * conversation id hides in, how a turn declares whether it is a question or an
 * answer, and the fact that a notebook with no history is an empty result
 * rather than an error.
 */
import { ChatRpc } from '../rpc/chat-rpc.js';

/** A `ChatRpc` whose client returns `result` for every call, recording the params. */
function rpcReturning(result: unknown) {
  const calls: Array<{ method: string; params: unknown; path: string }> = [];
  const client = {
    call: async (method: string, params: unknown, path: string) => {
      calls.push({ method, params, path });
      return result;
    },
  };
  return { chat: new ChatRpc(client as never), calls };
}

const NB = '11111111-2222-3333-4444-555555555555';
const CONV = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('ChatRpc.getLastConversationId', () => {
  it('digs the id out of the triple-nested envelope', async () => {
    const { chat, calls } = rpcReturning([[[CONV]]]);
    await expect(chat.getLastConversationId(NB)).resolves.toBe(CONV);
    expect(calls[0].method).toBe('GET_CONVERSATIONS');
    expect(calls[0].path).toBe(`/notebook/${NB}`);
  });

  it('returns null when nothing has been asked yet', async () => {
    const { chat } = rpcReturning([]);
    await expect(chat.getLastConversationId(NB)).resolves.toBeNull();
  });

  it('returns null rather than guessing on an unexpected shape', async () => {
    const { chat } = rpcReturning([[[42]]]);
    await expect(chat.getLastConversationId(NB)).resolves.toBeNull();
  });
});

describe('ChatRpc.getTurns', () => {
  const question = (text: string) => [null, null, 1, text];
  const answer = (text: string) => [null, null, 2, null, [[text]]];

  it('reads a question from slot 3 and an answer from [4][0][0]', async () => {
    const { chat, calls } = rpcReturning([
      [question('What is in here?'), answer('These sources.')],
    ]);

    await expect(chat.getTurns(NB, CONV, 2)).resolves.toEqual([
      { role: 'question', text: 'What is in here?' },
      { role: 'answer', text: 'These sources.' },
    ]);
    expect(calls[0].params).toEqual([[], null, null, CONV, 2]);
  });

  it('skips rows it cannot classify instead of inventing a role', async () => {
    const { chat } = rpcReturning([
      [[null, null, 7, 'unknown role'], ['too short'], question('Kept.')],
    ]);
    await expect(chat.getTurns(NB, CONV)).resolves.toEqual([{ role: 'question', text: 'Kept.' }]);
  });

  it('treats an empty conversation as no turns', async () => {
    const { chat } = rpcReturning([[]]);
    await expect(chat.getTurns(NB, CONV)).resolves.toEqual([]);
  });

  it('defaults the limit to 20', async () => {
    const { chat, calls } = rpcReturning([[]]);
    await chat.getTurns(NB, CONV);
    expect((calls[0].params as unknown[])[4]).toBe(20);
  });
});

describe('ChatRpc.deleteConversation', () => {
  it('sends the conversation id and scopes the call to the notebook', async () => {
    const { chat, calls } = rpcReturning([]);
    await chat.deleteConversation(NB, CONV);
    expect(calls[0].method).toBe('DELETE_CHAT_HISTORY');
    expect(calls[0].params).toEqual([[], CONV, null, 1]);
    expect(calls[0].path).toBe(`/notebook/${NB}`);
  });
});

describe('ChatRpc.cancelGeneration', () => {
  it('sends [null, conversationId] scoped to the notebook', async () => {
    const { chat, calls } = rpcReturning([]);
    await chat.cancelGeneration(NB, CONV);
    expect(calls[0].method).toBe('CANCEL_GENERATION');
    expect(calls[0].params).toEqual([null, CONV]);
    expect(calls[0].path).toBe(`/notebook/${NB}`);
  });

  it('resolves even when the server replies empty (fire-and-forget)', async () => {
    const { chat } = rpcReturning([]);
    await expect(chat.cancelGeneration(NB, CONV)).resolves.toBeUndefined();
  });
});
