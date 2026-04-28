/**
 * Q&A data contracts.
 *
 * Three zod schemas (all from @metu/shared):
 *   • questionAskSchema    — buyer asking on a product
 *   • questionEditSchema   — admin OR asker (body) / admin-only (answer)
 *   • questionAnswerSchema — seller-of-the-product OR admin
 */
export {
  questionAskSchema,
  questionEditSchema,
  questionAnswerSchema,
  type QuestionAskInput,
  type QuestionEditInput,
  type QuestionAnswerInput,
} from "@metu/shared";

import type { ProductQuestion } from "@prisma/client";

export type QuestionWithUsers = ProductQuestion & {
  asker: {
    userId: number;
    username: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
  };
  answerer?: {
    userId: number;
    username: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    stats?: { role: "buyer" | "seller" | "admin" } | null;
  } | null;
};
