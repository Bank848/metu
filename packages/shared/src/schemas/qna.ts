import { z } from "zod";

/**
 * Q&A schemas. Three forms:
 *   • ask    — buyer asking a question on a product
 *   • edit   — admin OR asker editing the question body; admin-only
 *              when editing the answer (sellers go through `answer`)
 *   • answer — seller (or admin) answering a question
 */
export const questionAskSchema = z.object({
  body: z.string().min(3).max(500),
});

export const questionEditSchema = z.object({
  body: z.string().min(3).max(500).optional(),
  answer: z.string().min(3).max(500).nullable().optional(),
});

export const questionAnswerSchema = z.object({
  answer: z.string().min(3).max(500),
});

export type QuestionAskInput = z.infer<typeof questionAskSchema>;
export type QuestionEditInput = z.infer<typeof questionEditSchema>;
export type QuestionAnswerInput = z.infer<typeof questionAnswerSchema>;
