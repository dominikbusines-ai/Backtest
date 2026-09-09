import { z } from "zod";

export const noteInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(120),
  content: z.string().trim().min(1, "Bitte einen Notiztext eingeben.").max(10000),
});

export const noteVersionSchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().datetime({ offset: true }),
});

export const noteUpdateSchema = noteInputSchema.extend({ updated_at: noteVersionSchema.shape.updated_at });
export type JournalNote = z.infer<typeof noteInputSchema> & { created_at: string; updated_at: string };
