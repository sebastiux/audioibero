import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, parseBody, requireUser, route } from "@/lib/api";
import { assertParticipantsFree, validateSlot } from "@/lib/rules";
import { planApplySchema } from "@/lib/validation";

/** Crea las reservas del plan personal. Cada bloque se valida por separado; los que chocan se omiten. */
export const POST = route(async (req) => {
  const me = await requireUser();
  const data = await parseBody(req, planApplySchema);
  const blocks = [...data.blocks].sort((a, b) => a.start.getTime() - b.start.getTime());

  // El proyecto (y la membresía) aplica a todos los bloques: si es inválido, se rechaza todo.
  const { projectId } = await validateSlot(
    { ...blocks[0], kind: data.kind, projectId: data.projectId },
    { userId: me.id, requireMembership: me.role !== "ADMIN" },
  );

  let created = 0;
  const skipped: { start: Date; reason: string }[] = [];
  for (const block of blocks) {
    try {
      await validateSlot({ ...block, kind: data.kind, projectId }, { userId: me.id, requireMembership: false });
      await assertParticipantsFree([me.id], block.start, block.end);
      await prisma.booking.create({
        data: {
          start: block.start,
          end: block.end,
          kind: data.kind,
          projectId,
          notes: data.notes || null,
          createdById: me.id,
          participants: { create: { userId: me.id } },
        },
      });
      created++;
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      skipped.push({ start: block.start, reason: err.message });
    }
  }
  return NextResponse.json({ created, skipped });
});
