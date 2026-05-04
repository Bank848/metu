/**
 * Reviews data contracts.
 * Two zod schemas: `reviewInputSchema` for create (full row required)
 * and `reviewEditSchema` for partial PATCH. Both come from
 * @metu/shared so the BFF form components AND the API parse with
 * the same definition.
 */
export {
  reviewInputSchema,
  reviewEditSchema,
  type ReviewInput,
  type ReviewEditInput,
} from "@metu/shared";

import type { ProductReview } from "@prisma/client";

export type ReviewWithAuthor = ProductReview & {
  user: {
    userId?: number;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    username: string;
  };
};
