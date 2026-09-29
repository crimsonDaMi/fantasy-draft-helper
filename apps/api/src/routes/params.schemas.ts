import { z } from "zod";

export const rankingParamsSchema = z.object({
  rankingId: z.string().min(1),
});

export const draftParamsSchema = z.object({
  draftId: z.string().min(1),
});
