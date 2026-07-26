import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiSseRequest } from "./client";

describe("apiSseRequest", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "admin-1",
          email: "admin@vietride.vn",
          displayName: "Admin",
          phone: "0901234567",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
  });

  it("parses token and done events from a streamed response", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        [
          'event: token\ndata: {"content":"Xin "}\n\n',
          'event: token\ndata: {"content":"chào"}\n\n',
          'event: done\ndata: {"conversationId":"conversation-1","userMessageId":"user-message-1","assistantMessageId":"assistant-message-1","citedChunkIds":[]}\n\n',
        ].join(""),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const events: Array<{ event: string; data: unknown }> = [];

    await apiSseRequest(
      "/v1/rag/chat",
      {
        method: "POST",
        body: { message: "Xin chào" },
        headers: { Accept: "text/event-stream" },
      },
      (event) => events.push(event),
    );

    expect(events).toEqual([
      { event: "token", data: { content: "Xin " } },
      { event: "token", data: { content: "chào" } },
      {
        event: "done",
        data: {
          conversationId: "conversation-1",
          userMessageId: "user-message-1",
          assistantMessageId: "assistant-message-1",
          citedChunkIds: [],
        },
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/rag/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "text/event-stream",
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });
});
