export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** ISO time để hiện giờ gửi dưới mỗi bong bóng */
  createdAt: string;
  assistantMessageId?: string;
  citedChunkIds?: string[];
  rating?: -1 | 1;
};
