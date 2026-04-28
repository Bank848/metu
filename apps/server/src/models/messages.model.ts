/**
 * Phase 13.8 — messages resource: re-exports the shared zod schema +
 * defines the DTO types the controller serialises back to the BFF.
 *
 * The Postgres path uses the existing `Message` model in
 * packages/db/prisma/schema.prisma (relational integrity preserved).
 * A future MongoDB sidecar pilot would replace `services/messages.service.ts`
 * but leave this file alone — DTOs are the network contract.
 */
import { sendMessageSchema, type SendMessageInput } from "@metu/shared";
export { sendMessageSchema, type SendMessageInput };

export interface UserSummary {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
}

export interface MessageRow {
  messageId: number;
  senderId: number;
  recipientId: number;
  body: string;
  orderId: number | null;
  productId: number | null;
  readAt: Date | null;
  createdAt: Date;
  // Thread responses include the sender for each row so the UI can
  // alternate left/right alignment without a follow-up call.
  sender?: UserSummary;
}

export interface ThreadResponse {
  messages: MessageRow[];
  other: UserSummary | null;
}

export interface InboxThread {
  partner: UserSummary;
  lastMessage: string;
  lastAt: Date;
  unread: number;
}

export interface InboxResponse {
  threads: InboxThread[];
}

export interface SendResponse {
  ok: true;
  message: MessageRow;
}

export interface UnreadResponse {
  count: number;
}
