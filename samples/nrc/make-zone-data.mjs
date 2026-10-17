// Writes samples/nrc/nrc-zones.csv, the Duplex zoning, from the spaces of samples/nrc/duplex-base.ifc.
//
//   node samples/nrc/make-zone-data.mjs            rewrite the committed file
//   node samples/nrc/make-zone-data.mjs --check    exit 1 if the committed file differs from the output
//   node samples/nrc/make-zone-data.mjs --out <path>
//
// The rule, in one sentence: one zone per dwelling per floor. A space's Name is its room number: the
// first letter is the dwelling (A or B) and the first digit the floor (1 or 2), so A101 is dwelling A,
// Level 1. R301 Roof (the unconditioned roof space) belongs to no zone. The model itself has no zones;
// the zoning is analytics-contract data (Layer 2) that nrc-enrich-run writes back as IfcZone groups.
// The table is synthetic, like the rest of the NRC analytics.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const IFC = resolve(here, "duplex-base.ifc");
const ZONES_CSV = resolve(here, "nrc-zones.csv");
const ZONE_HEADER = "ZoneName,SpaceGlobalId,RoomNumber,RoomName";

/** The IfcSpace entities of a STEP file: GlobalId, Name (room number), and LongName (room name). */
export function readSpaces(ifcPath = IFC) {
  const text = readFileSync(ifcPath, "latin1");
  const spaces = [];
  for (const m of text.matchAll(/^#(\d+)=IFCSPACE\('([^']*)',#\d+,'([^']*)','[^']*',\$,#\d+,#\d+,'([^']*)'/gm))
    spaces.push({ stepId: Number(m[1]), globalId: m[2], number: m[3], name: m[4] });
  return spaces;
}

/** The zone of a room number, or null for a space outside every zone. */
export function zoneOf(number) {
  const m = /^([AB])([12])\d\d$/.exec(number);
  return m ? `Unit ${m[1]} Level ${m[2]}` : null;
}

export function zoneRows(spaces) {
  return spaces
    .map((s) => ({ ...s, zone: zoneOf(s.number) }))
    .filter((s) => s.zone !== null)
    .sort((a, b) => a.zone.localeCompare(b.zone) || a.number.localeCompare(b.number))
    .map((s) => `${s.zone},${s.globalId},${s.number},${s.name}`);
}

export function zonesCsv(spaces) {
  return [ZONE_HEADER, ...zoneRows(spaces)].join("\n") + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const out = args.includes("--out") ? resolve(args[args.indexOf("--out") + 1]) : ZONES_CSV;
  const csv = zonesCsv(readSpaces());
  if (args.includes("--check")) {
    const current = readFileSync(ZONES_CSV, "utf8").replace(/\r\n/g, "\n");
    if (current !== csv) {
      console.error("samples/nrc/nrc-zones.csv is stale; run node samples/nrc/make-zone-data.mjs");
      process.exit(1);
    }
  } else {
    writeFileSync(out, csv);
    console.log(`wrote ${out}`);
  }
}
