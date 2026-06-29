/**
 * POST /api/ingest
 *
 * Accepts a batch of RawEvent[] from the RuneLite plugin (LootWriter.flush),
 * replays the Net-Diff / context-locking / XP-attribution / quest classifiers
 * per session (state persisted in Supabase `session_state`), and writes:
 *   - raw_events   — verbatim archive of every incoming event
 *   - loot_logs    — classified rows in the exact shape the frontend reads
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (server-only; never NEXT_PUBLIC_).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabaseAdmin';
import { SessionClassifier, freshSessionState } from '@/lib/ingest/classifier';
import type { RawEvent, SessionState } from '@/lib/ingest/types';

/** Processing priority within a clientTick: lower = earlier. */
function typePriority(type: string): number {
  switch (type) {
    case 'MENU_CLICK': return 0; // locks context before consequences
    case 'XP_UPDATE':
    case 'NPC_LOOT':
    case 'QUEST_STATE': return 1; // use current locks, previous net-diff fallback
    case 'TICK':
    case 'SHOP_STOCK':
    case 'EXAMINE_TEXT': return 2; // runs net-diff at end of tick
    default: return 2;
  }
}

export async function POST(req: Request): Promise<Response> {
  console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('SERVICE KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  // --- 1. Parse body ---
  let events: RawEvent[];
  try {
    const body = await req.json();
    if (!Array.isArray(body)) throw new Error('Expected JSON array');
    events = body as RawEvent[];
  } catch (err) {
    console.error('[ingest] Bad request:', err);
    return Response.json({ error: 'Invalid JSON — expected RawEvent[]' }, { status: 400 });
  }

  if (events.length === 0) {
    return Response.json({ ingested: 0 });
  }

  // --- 2. Group by sessionId ---
  const bySession = new Map<string, RawEvent[]>();
  for (const event of events) {
    if (!event.sessionId) continue;
    let arr = bySession.get(event.sessionId);
    if (!arr) { arr = []; bySession.set(event.sessionId, arr); }
    arr.push(event);
  }

  const supabase = createAdminClient();
  let totalIngested = 0;

  // --- 3. Process each session independently ---
  for (const [sessionId, sessionEvents] of bySession) {
    try {
      // 3a. Archive raw events
      const { error: rawErr } = await supabase.from('raw_events').insert(
        sessionEvents.map((e) => ({
          session_id: e.sessionId,
          client_tick: e.clientTick ?? null,
          event: e,
        })),
      );
      if (rawErr) console.error(`[ingest][${sessionId}] raw_events insert error:`, rawErr.message);

      // 3b. Load persisted session state (or start fresh)
      const { data: stateRow } = await supabase
        .from('session_state')
        .select('state')
        .eq('session_id', sessionId)
        .maybeSingle();

      const loadedState: SessionState | null = stateRow?.state ?? null;

      // 3c. Sort events: clientTick asc, then type priority asc (stable within priority)
      const sorted = [...sessionEvents].sort((a, b) => {
        const tickDiff = (a.clientTick ?? 0) - (b.clientTick ?? 0);
        if (tickDiff !== 0) return tickDiff;
        return typePriority(a.type) - typePriority(b.type);
      });

      // 3d. Classify
      const classifier = SessionClassifier.rehydrate(loadedState);
      const classifiedRows = sorted.flatMap((e) => classifier.process(e));

      // 3e. Write classified rows to loot_logs
      if (classifiedRows.length > 0) {
        const { error: logErr } = await supabase
          .from('loot_logs')
          .insert(classifiedRows.map((r) => ({ log_data: r })));
        if (logErr) console.error(`[ingest][${sessionId}] loot_logs insert error:`, logErr.message);
      }

      // 3f. Upsert session state
      const { error: stateErr } = await supabase.from('session_state').upsert(
        {
          session_id: sessionId,
          state: classifier.dump(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' },
      );
      if (stateErr) console.error(`[ingest][${sessionId}] session_state upsert error:`, stateErr.message);

      totalIngested += classifiedRows.length;
    } catch (err) {
      console.error(`[ingest] Unhandled error for session ${sessionId}:`, err);
      // Continue with remaining sessions — don't fail the whole batch
    }
  }

  if (totalIngested > 0) {
    console.log(`[ingest] Successfully processed and saved ${totalIngested} classified events!`);
  }

  return Response.json({ ingested: totalIngested });
}
