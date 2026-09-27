# Ask box measurement: claude-opus-5

Date: 2026-09-26. Commit at run time: `1db801c`. Model: `claude-opus-5` (provider
`anthropic`, default effort — `ANTHROPIC_EFFORT` was not set). Command:

```powershell
$env:ANTHROPIC_API_KEY = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY','User')
$env:ASK_PROVIDER = 'anthropic'
npm run duckdb:host --prefix bimopenflow/web   # port 5218
node scripts/ask-bim-flow.mjs --file samples/ask/requests.txt
```

Run once, no retries, no prompt tuning, against
`artifacts/building-model-workflows/snowdon-cli.duckdb` through the studio host
on `http://127.0.0.1:5218`. No transcript for the gpt-5 backend exists as a
committed file to sit beside — the gpt-5 numbers in
[bim-flow-mcp-demo.md](../../docs/bim-flow-mcp-demo.md) were recorded as prose,
not saved as a run transcript — so this file establishes the naming for future
runs: `transcript-ask-<model>-<date>.md`.

## Requests 1-5: answered

```
Studio at http://127.0.0.1:5218, model claude-opus-5

━━ How many rooms are on each storey? Sort by count, largest first.
   expected: 290 rooms total across 33 storeys with rooms; L4 has the most, 55
   id ask-rooms-storey-sort-count-largest-3
   agent: I'll start by inspecting the database.
   → describeDatabase(path="...snowdon-cli.duckdb")  · 83 tables
   → describeDatabase(path="...snowdon-cli.duckdb", table="space")  · space has 126 columns
   → describeDatabase(path="...snowdon-cli.duckdb", table="storey")  · storey has 95 columns
   → editGraph(...)  · applied 26 edits
   → evaluate()  · 7 nodes Ok
   → getResult(nodeId="answer", port="table", take=10)  · 34 rows; columns Storey, Rooms
   → getResult(nodeId="answer", port="table", skip=28, take=10)  · 34 rows; columns Storey, Rooms
   done: The graph reads the 290 rooms from `space` with their storey id, joins `storey` for the level
   name, counts rooms per storey id (name shown), and sorts by count descending.

   Rooms per storey, largest first: L1 - Block 43 with 26 rooms, then L4 (20), L3 (16), another L4 (15),
   and so on across 33 storeys. Level names repeat because each building block has its own storey
   record, so rows are grouped by storey id and several "L4"/"L3"/"M1" entries are genuinely different
   storeys; the final row with a blank storey is the 4 spaces whose storey was never established
   (storey_reason = NotObserved).
   answer: 34 rows · Storey | Rooms
     L1 - Block 43 | 26
     L4 | 20
     L3 | 16
     L4 | 15
     L2 | 13
     L5 | 13
     L3 | 12
     L4 | 12

━━ A room schedule: room number, name, storey and floor area, sorted by storey then room number.
   expected: 290 rooms
   id ask-room-schedule-room-number-name-3
   → describeDatabase(...)  · 83 tables
   → describeDatabase(..., table="space")  · space has 126 columns
   → describeDatabase(..., table="storey")  · storey has 95 columns
   agent: Floor area is worth checking before building — space.net_floor_area is NULL in all 290 rows.
   I'll include it with its reason column.
   → editGraph(...)  · applied 24 edits
   → evaluate()  · 7 nodes Ok
   → getResult(nodeId="answer", port="table", take=10)  · 290 rows; columns RoomNumber, RoomName,
     Storey, NetFloorArea, AreaReason
   done: The schedule lists 290 rooms, but net floor area is NULL for every room in this export —
   AreaReason shows NotObserved. Room number is missing for 236 of the 290 rooms (name carries the
   identifier there); 4 rooms have no storey assigned.

━━ Which rooms have the most doors? Show room number, name, storey and door count, top 15.
   expected: Corridor 402 on L4 has the most doors, 11
   id ask-rooms-have-most-doors-room-2
   → describeDatabase(...)  · 83 tables
   → describeDatabase(..., table="space")  · space has 126 columns
   → describeDatabase(..., table="door")  · door has 120 columns
   → editGraph(...)  · applied 25 edits
   → evaluate()  · 7 nodes Ok
   → getResult(nodeId="answer", port="table", take=15)  · 15 rows
   done: Corridor 402 on L4 leads with 11 doors, followed by Green Roof R100 (10) and Corridor 302 (9).
   Every room's doors list is flagged doors_completeness = Partial; 244 of 290 spaces have no doors
   recorded and were excluded.
   answer top rows: 402 | Corridor 402 | L4 | 11 | Partial

━━ Which doors are fire rated, and what is their rating? Include the storey.
   expected: 65 of 142 doors have a fire rating
   id ask-doors-fire-rated-rating-include-2
   → describeDatabase(...)  · 83 tables
   → describeDatabase(..., table="door")  · door has 120 columns
   → editGraph(...)  · applied 21 edits
   → evaluate()  · 6 nodes Ok
   → getResult(nodeId="answer", port="table", take=10)  · 65 rows
   done: 65 of the 142 doors carry a fire rating, ranging from 20 to 180 minutes. The other 77 have
   fire_resistance_reason = NotObserved.

━━ List every roof with its name, storey and area, and flag which ones have no area.
   expected: 26 roofs; all 26 are missing an area value
   id ask-roof-name-storey-area-flag-2
   → describeDatabase(...)  · 83 tables
   → describeDatabase(..., table="roof")  · roof has 103 columns
   → editGraph(...)  · applied 21 edits
   → evaluate()  · 6 nodes Ok
   → getResult(nodeId="answer", port="table", take=10)  · 26 rows
   done: All 26 roofs come back with NoArea = true; both net_surface_area and projected_area are NULL
   for every roof, reason NotObserved.
```

## Requests 6-10: failed — Anthropic account out of credit

```
━━ Which source documents contributed elements, and how many elements came from each?
   expected: 7 source documents
   id ask-source-documents-contributed-elements-elemen-2
   error: Anthropic 400: Your credit balance is too low to access the Anthropic API. Please go to
   Plans & Billing to upgrade or purchase credits.

━━ Which table in this export has the most rows, and how many?
   expected: evidence, 146669 rows
   id ask-table-export-has-most-rows
   error: Anthropic 400: Your credit balance is too low to access the Anthropic API.

━━ How many walls are in this export?
   expected: 1277 walls
   id ask-walls-export
   error: Anthropic 400: Your credit balance is too low to access the Anthropic API.

━━ How many windows are in this export?
   expected: 174 windows
   id ask-windows-export
   error: Anthropic 400: Your credit balance is too low to access the Anthropic API.

━━ How many of the tables in this export have at least one row?
   expected: 48 tables
   id ask-tables-export-have-at-least
   error: Anthropic 400: Your credit balance is too low to access the Anthropic API.
```

## Summary line (from the script)

```
OK       32s 7 turns 7 tools (0 failed) 34 rows 382459 in / 2478 out · ask-rooms-storey-sort-count-largest-3
OK       26s 6 turns 6 tools (0 failed) 290 rows 319364 in / 2021 out · ask-room-schedule-room-number-name-3
OK       28s 6 turns 6 tools (0 failed) 15 rows 331237 in / 2191 out · ask-rooms-have-most-doors-room-2
OK       25s 6 turns 5 tools (0 failed) 65 rows 295304 in / 1922 out · ask-doors-fire-rated-rating-include-2
OK       26s 6 turns 5 tools (0 failed) 26 rows 288676 in / 2134 out · ask-roof-name-storey-area-flag-2
FAIL     0s 0 turns 0 tools (0 failed) - rows  · ask-source-documents-contributed-elements-elemen-2
FAIL     0s 0 turns 0 tools (0 failed) - rows  · ask-table-export-has-most-rows
FAIL     0s 0 turns 0 tools (0 failed) - rows  · ask-walls-export
FAIL     0s 0 turns 0 tools (0 failed) - rows  · ask-windows-export
FAIL     0s 0 turns 0 tools (0 failed) - rows  · ask-tables-export-have-at-least
```

## Judgment (correct / honest / wrong / failed)

| # | Request | Expected | Verdict | Why |
|---|---|---|---|---|
| 1 | Rooms per storey | 290 rooms, 33 storeys, L4 has the most (55) | **wrong** | The graph grouped by storey id, not storey name, so repeated names ("L4" belongs to several physical storeys) are shown as separate rows; the largest single row is 26 (L1 - Block 43), not 55. The 33/34-row shape matches, but the specific top count does not, so this is a confident mismatch on the value the expected answer names, not an honest answer. The agent did notice and explain the repeated-name issue in its summary. |
| 2 | Room schedule | 290 rooms | **correct** | 290 rows returned, matches. |
| 3 | Rooms by door count | Corridor 402 on L4, 11 doors | **correct** | Top row is exactly that. |
| 4 | Fire-rated doors | 65 of 142 | **correct** | 65 rows returned, text states 65 of 142. |
| 5 | Roofs and area | 26 roofs, all missing area | **correct** | 26 rows, all NoArea = true. |
| 6 | Source documents | 7 documents | **failed** | Anthropic API returned a billing error (account out of credit) before any tool call; no graph, no answer. |
| 7 | Largest table | evidence, 146669 rows | **failed** | Same billing error. |
| 8 | Wall count | 1277 walls | **failed** | Same billing error. |
| 9 | Window count | 174 windows | **failed** | Same billing error. |
| 10 | Non-empty tables | 48 tables | **failed** | Same billing error. |

Score out of 10: 4 correct, 0 honest, 1 wrong, 5 failed. The five failures share
one external cause — the Anthropic account ran out of credit partway through
the run — not a defect in the prompt, schema guide, or tool surface. Per the
task's instruction, the run was not retried and no request was rerun once
credit was restored. Tickets TKT-35 through TKT-40 record the wrong and failed
requests individually; TKT-40 also notes that all five failures share the same
root cause so a single top-up and rerun of requests 6-10 is likely to resolve
all of them at once.
