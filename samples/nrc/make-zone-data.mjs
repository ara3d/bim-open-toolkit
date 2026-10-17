// Writes the zone-level inputs of the NRC enrichment from the spaces of samples/nrc/duplex-base.ifc:
//
//   nrc-zones.csv            the Duplex zoning: which space belongs to which zone
//   nrc_analytics_spaces.csv the synthetic per-space values: floor area, annual energy, annual carbon
//
//   node samples/nrc/make-zone-data.mjs                  rewrite both committed files
//   node samples/nrc/make-zone-data.mjs --check          exit 1 if either committed file differs from the output
//   node samples/nrc/make-zone-data.mjs --zones-out <path> --spaces-out <path>   write elsewhere (either flag alone writes only that file)
//
// The zoning rule, in one sentence: one zone per dwelling per floor. A space's Name is its room number:
// the first letter is the dwelling (A or B) and the first digit the floor (1 or 2), so A101 is dwelling A,
// Level 1. R301 Roof (the unconditioned roof space) belongs to no zone. The model itself has no zones;
// the zoning is analytics-contract data (Layer 2) that nrc-enrich-run writes back as IfcZone groups.
//
// The space values follow the generator of the other NRC CSVs in being synthetic and deterministic:
//   - NRC.AREA.FLOOR is the space's own "GSA BIM Area" quantity from the model, rounded to 0.01 m2. It is
//     a copy of model data kept in the CSV so a zone's intensity can be computed from the CSVs alone;
//     ZoneRollupTests checks it against the model.
//   - NRC.ENERGY.ANNUAL is area times an intensity by room type (kWh/m2/yr, SPACE_INTENSITY below), and
//     dwelling B uses 1.06 times dwelling A's, so the zones differ, rounded to 0.1 kWh.
//   - NRC.OC.ANNUAL is that energy times the grid emission factor of nrc-run.csv, rounded to 0.1 kgCO2e.
// No zone total appears in any input; the rollup graph computes them.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const IFC = resolve(here, "duplex-base.ifc");
const RUN_CSV = resolve(here, "nrc-run.csv");
const ZONES_CSV = resolve(here, "nrc-zones.csv");
const SPACES_CSV = resolve(here, "nrc_analytics_spaces.csv");
const ZONE_HEADER = "ZoneName,SpaceGlobalId,RoomNumber,RoomName";
const SPACE_HEADER =
  "AnalysisRunId,GlobalId,IfcClass,MetricId,MetricName,Value,Unit,LifecycleStage,Scenario,Source,Confidence,ComputationMethod";

/** Annual energy use intensity by room type, kWh per m2 per year (synthetic). */
const SPACE_INTENSITY = {
  Foyer: 55, "Living Room": 65, Kitchen: 120, Bathroom: 90, Stair: 40, Room: 50,
  Hallway: 45, Bedroom: 60, Utility: 70,
};
const DWELLING_FACTOR = { A: 1.0, B: 1.06 };

/** The IfcSpace entities of a STEP file: GlobalId, Name (room number), LongName (room name), and GSA BIM Area. */
export function readSpaces(ifcPath = IFC) {
  const text = readFileSync(ifcPath, "latin1");
  const entities = new Map();
  for (const m of text.matchAll(/^#(\d+)=(\w+)\((.*)\);\s*$/gm)) entities.set(Number(m[1]), { type: m[2], args: m[3] });

  const areaOf = new Map();
  for (const { type, args } of entities.values()) {
    if (type !== "IFCRELDEFINESBYPROPERTIES") continue;
    const rel = /^'[^']*',#\d+,\$,\$,\(([^)]*)\),#(\d+)/.exec(args);
    const set = rel && entities.get(Number(rel[2]));
    if (!set || set.type !== "IFCELEMENTQUANTITY") continue;
    for (const [, id] of set.args.matchAll(/#(\d+)/g)) {
      const q = entities.get(Number(id));
      const area = q && q.type === "IFCQUANTITYAREA" && /^'GSA BIM Area',\$,\$,([-0-9.eE+]+)$/.exec(q.args);
      if (area) for (const [, obj] of rel[1].matchAll(/#(\d+)/g)) areaOf.set(Number(obj), Number(area[1]));
    }
  }

  const spaces = [];
  for (const m of text.matchAll(/^#(\d+)=IFCSPACE\('([^']*)',#\d+,'([^']*)','[^']*',\$,#\d+,#\d+,'([^']*)'/gm))
    spaces.push({ stepId: Number(m[1]), globalId: m[2], number: m[3], name: m[4], area: areaOf.get(Number(m[1])) });
  return spaces;
}

/** The zone of a room number, or null for a space outside every zone. */
export function zoneOf(number) {
  const m = /^([AB])([12])\d\d$/.exec(number);
  return m ? `Unit ${m[1]} Level ${m[2]}` : null;
}

function conditioned(spaces) {
  return spaces
    .map((s) => ({ ...s, zone: zoneOf(s.number) }))
    .filter((s) => s.zone !== null)
    .sort((a, b) => a.zone.localeCompare(b.zone) || a.number.localeCompare(b.number));
}

export function zonesCsv(spaces) {
  return [ZONE_HEADER, ...conditioned(spaces).map((s) => `${s.zone},${s.globalId},${s.number},${s.name}`)].join("\n") + "\n";
}

/** nrc-run.csv as a Field to Value map. */
function runFacts(path = RUN_CSV) {
  const facts = {};
  for (const line of readFileSync(path, "utf8").replace(/\r\n/g, "\n").split("\n").slice(1)) {
    const [field, , ...value] = line.split(",");
    if (field) facts[field] = value.join(",").replace(/^"|"$/g, "");
  }
  return facts;
}

export function spacesCsv(spaces, facts = runFacts()) {
  const run = facts.AnalysisRunId;
  const scenario = facts.ScenarioName;
  const grid = Number(facts.GridEmissionFactor_kgCO2e_per_kWh);
  const rows = [];
  for (const s of conditioned(spaces)) {
    if (s.area === undefined) throw new Error(`space ${s.number} has no GSA BIM Area`);
    const base = s.name.replace(/\s*\d+$/, "");
    const intensity = SPACE_INTENSITY[base];
    if (intensity === undefined) throw new Error(`no intensity for room type '${base}' (${s.number})`);
    const area = Math.round(s.area * 100) / 100;
    const energy = Math.round(area * intensity * DWELLING_FACTOR[s.number[0]] * 10) / 10;
    const carbon = Math.round(energy * grid * 10) / 10;
    const line = (metricId, metricName, value, unit, stage, source, method) =>
      [run, s.globalId, "IFCSPACE", metricId, metricName, value, unit, stage, scenario, source, "0.5", method].join(",");
    rows.push(line("NRC.AREA.FLOOR", "FloorArea_m2", area.toFixed(2), "m2", "", "model:GSA BIM Area", "model-quantity-rounded-0.01"));
    rows.push(line("NRC.ENERGY.ANNUAL", "OperationalEnergy_kWh_per_year", energy.toFixed(1), "kWh/yr", "B6", "synthetic-generator-v1", "area-x-room-type-intensity"));
    rows.push(line("NRC.OC.ANNUAL", "OperationalCarbon_kgCO2e_per_year", carbon.toFixed(1), "kgCO2e/yr", "B6", "synthetic-generator-v1", "energy-x-grid-factor"));
  }
  return [SPACE_HEADER, ...rows].join("\n") + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (name) => (args.includes(name) ? resolve(args[args.indexOf(name) + 1]) : undefined);
  const spaces = readSpaces();
  const outputs = [
    { committed: ZONES_CSV, out: arg("--zones-out"), text: zonesCsv(spaces) },
    { committed: SPACES_CSV, out: arg("--spaces-out"), text: spacesCsv(spaces) },
  ];
  if (args.includes("--check")) {
    let stale = false;
    for (const o of outputs) {
      if (readFileSync(o.committed, "utf8").replace(/\r\n/g, "\n") !== o.text) {
        console.error(`${o.committed} is stale; run node samples/nrc/make-zone-data.mjs`);
        stale = true;
      }
    }
    if (stale) process.exit(1);
  } else {
    const chosen = outputs.some((o) => o.out) ? outputs.filter((o) => o.out) : outputs;
    for (const o of chosen) {
      writeFileSync(o.out ?? o.committed, o.text);
      console.log(`wrote ${o.out ?? o.committed}`);
    }
  }
}
