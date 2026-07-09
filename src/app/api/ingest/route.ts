/**
 * POST /api/ingest
 *
 * Accepts a batch of RawEvent[] from the RuneLite plugin (LootWriter.flush),
 * replays the Net-Diff / context-locking / XP-attribution / quest classifiers
 * per session (state persisted in Supabase `session_state`), and writes:
 *   - raw_events   — verbatim archive of every incoming event
 *   - loot_logs    — classified rows in the exact shape the frontend reads
 *
 * Requires an X-Api-Key header matching a row in `api_keys`. Each key is
 * permanently linked to one `characters` row (via character_id FK) — this
 * is what guarantees Main and Ironman data can never cross-pollinate, since
 * the link is enforced by the database rather than a free-text label.
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
  // --- 1. Validate API key and resolve its character ---
  const apiKey = req.headers.get('X-Api-Key');
  if (!apiKey) {
    return Response.json({ error: 'Missing API key' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: keyRow, error: keyErr } = await supabase
      .from('api_keys')
      .select('user_id, character_id')
      .eq('key', apiKey)
      .maybeSingle();

  if (keyErr) {
    console.error('[ingest] API key lookup error:', keyErr.message);
    return Response.json({ error: 'Internal error validating key' }, { status: 500 });
  }

  if (!keyRow) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  if (!keyRow.character_id) {
    console.error('[ingest] API key has no linked character:', apiKey);
    return Response.json({ error: 'API key is not linked to a character' }, { status: 500 });
  }

  const userId = keyRow.user_id as string;
  const characterId = keyRow.character_id as string;

  // --- 2. Parse body ---
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

  // --- 3. Group by sessionId ---
  const bySession = new Map<string, RawEvent[]>();
  for (const event of events) {
    if (!event.sessionId) continue;
    let arr = bySession.get(event.sessionId);
    if (!arr) { arr = []; bySession.set(event.sessionId, arr); }
    arr.push(event);
  }

  let totalIngested = 0;

  // --- 4. Process each session independently ---
  for (const [sessionId, sessionEvents] of bySession) {
    try {
      // 4a. Archive raw events, tagged with user_id + character_id
      const { error: rawErr } = await supabase.from('raw_events').insert(
          sessionEvents.map((e) => ({
            session_id: e.sessionId,
            client_tick: e.clientTick ?? null,
            event: e,
            user_id: userId,
            character_id: characterId,
          })),
      );
      if (rawErr) console.error(`[ingest][${sessionId}] raw_events insert error:`, rawErr.message);

      // 4b. Load persisted session state, scoped to this character
      //     (session_id + character_id is the unique key — see migration)
      const { data: stateRow } = await supabase
          .from('session_state')
          .select('state')
          .eq('session_id', sessionId)
          .eq('character_id', characterId)
          .maybeSingle();

      const loadedState: SessionState | null = stateRow?.state ?? null;

      // 4c. Sort events: clientTick asc, then type priority asc (stable within priority)
      const sorted = [...sessionEvents].sort((a, b) => {
        const tickDiff = (a.clientTick ?? 0) - (b.clientTick ?? 0);
        if (tickDiff !== 0) return tickDiff;
        return typePriority(a.type) - typePriority(b.type);
      });

      // 4d. Classify
      const classifier = SessionClassifier.rehydrate(loadedState);
      const classifiedRows = sorted.flatMap((e) => classifier.process(e));

      // 4e. Write classified rows to loot_logs, tagged with user_id + character_id
      if (classifiedRows.length > 0) {
        const { error: logErr } = await supabase
            .from('loot_logs')
            .insert(classifiedRows.map((r) => ({
              log_data: r,
              user_id: userId,
              character_id: characterId,
            })));
        if (logErr) console.error(`[ingest][${sessionId}] loot_logs insert error:`, logErr.message);
      }

      // 4f. Upsert session state, scoped to this character
      const { error: stateErr } = await supabase.from('session_state').upsert(
          {
            session_id: sessionId,
            user_id: userId,
            character_id: characterId,
            state: classifier.dump(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,character_id' },
      );
      if (stateErr) console.error(`[ingest][${sessionId}] session_state upsert error:`, stateErr.message);

      totalIngested += classifiedRows.length;
    } catch (err) {
      console.error(`[ingest] Unhandled error for session ${sessionId}:`, err);
      // Continue with remaining sessions — don't fail the whole batch
    }
  }

  return Response.json({ ingested: totalIngested });
}