import { json, Router } from "express";
import { z } from "zod";

import { prisma } from "../../prisma";
import { requireAuth } from "../../utils/auth";
import { parseJson } from "../../utils/parseJson";

const router = Router();

const DrillAttemptSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  decision: z.enum(["PASS", "FAIL", "NEEDS_REGEN"]),
  qa: z
    .object({
      scores: z.object({
        structure: z.number().optional(),
        // ... other score fields
      }),
      // ... other QA report fields
    })
    .nullable(),
});

const GenerateDrillRequestSchema = z.object({
  // ... other fields
  attempts: z.array(DrillAttemptSchema),
});

router.post(
  "/coach/generate-drill-vetted",
  requireAuth,
  async (req, res) => {
    const parsed = GenerateDrillRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid request data.",
        issues: parsed.error.issues,
      });
    }

    const { attempts } = parsed.data;

    // --- existing code for processing attempts ---

    // --- REPLACED FAILURE HANDLING BLOCK ---
    {
      // compute best attempt by 'structure' QA score (descending)
      const bestAttempt = attempts
        .slice()
        .sort((a, b) => {
          const aScore = a.qa?.scores?.structure ?? 0;
          const bScore = b.qa?.scores?.structure ?? 0;
          return bScore - aScore;
        })[0];

      const devFailOpen = process.env.ACI_QA_DEV_FAIL_OPEN === "1";

      if (bestAttempt && devFailOpen) {
        console.log(
          "ACI: All attempts NEEDS_REGEN, but devFailOpen is on — returning best attempt anyway."
        );
        return res.json({
          ok: true,
          drill: bestAttempt.drill,
          qa: bestAttempt.qa,
          qaStatus: bestAttempt.decision,
          attemptsSummary: attempts.map((a) => ({
            title: a.title,
            decision: a.decision,
            scores: a.qa?.scores,
          })),
        });
      }

      console.error(
        "ACI: Final Status: FAILURE — all attempts NEEDS_REGEN and devFailOpen is off."
      );
      return res.status(500).json({
        ok: false,
        error: "All vetted attempts failed QA (NEEDS_REGEN).",
        attemptsSummary: attempts.map((a) => ({
          title: a.title,
          decision: a.decision,
          scores: a.qa?.scores,
        })),
      });
    }
    // --- end of replaced block ---

    // --- existing code ---
  }
);

export { router as coachRouter };