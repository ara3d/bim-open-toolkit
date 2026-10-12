// Writes samples/nrc/ids/nrc-analytics.ids, the IDS (Information Delivery Specification) that
// requires the NRC carbon properties on every analysed element, from the metric dictionary
// samples/nrc/nrc-metrics.csv (TKT-50).
//
//   node scripts/nrc-ids.mjs            rewrite the committed file
//   node scripts/nrc-ids.mjs --check    exit 1 if the committed file differs from the output
//   node scripts/nrc-ids.mjs --out <path>
//
// Where each part of the file comes from:
//
//   - Each requirement's property set, property name, and dataType: the metric's element-level
//     row in nrc-metrics.csv (ValueType Real becomes IFCREAL, and so on through DATA_TYPES).
//   - Which metrics become specifications, and their names: SPECIFICATIONS below. The dictionary
//     has five element-level rows, but the IDS requires two: annual operational carbon (IDS-OC)
//     and A1-A3 embodied carbon (IDS-EC), the two the NRC paper's checks name. The names are
//     the CheckIds the sample graphs in samples/checking-analyses and their tests expect, and
//     the CSV has no column that says which metrics an IDS should require.
//   - The fourteen IFC classes of the applicability: ANALYSED_CLASSES below, in the order the
//     file was first written by hand (2026-09-27). The set is checked against the IfcClass
//     column of samples/nrc/nrc_analytics_long.csv, the classes that carry analytics rows, and
//     the script fails when the two disagree. The order is kept so the file stays byte-identical
//     to its copy in bim-open-data (tests/data/Ara3D.Ids.Tests/ids), that repository's fixture.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nrc = resolve(root, "samples", "nrc");
const METRICS_CSV = resolve(nrc, "nrc-metrics.csv");
const LONG_CSV = resolve(nrc, "nrc_analytics_long.csv");
const IDS_FILE = resolve(nrc, "ids", "nrc-analytics.ids");

const SPECIFICATIONS = [
  { name: "IDS-OC", metricId: "NRC.OC.ANNUAL" },
  { name: "IDS-EC", metricId: "NRC.EC.A1A3.TOTAL" },
];

const ANALYSED_CLASSES = [
  "IFCWALL", "IFCWALLSTANDARDCASE", "IFCWINDOW", "IFCDOOR", "IFCROOF", "IFCSLAB", "IFCBEAM",
  "IFCCOVERING", "IFCRAILING", "IFCSTAIR", "IFCSTAIRFLIGHT", "IFCFOOTING", "IFCFURNISHINGELEMENT",
  "IFCMEMBER",
];

/** nrc-metrics.csv ValueType to IDS dataType. The Text, Label, and Identifier types are those nrc-run.csv uses. */
const DATA_TYPES = { Real: "IFCREAL", Integer: "IFCINTEGER", Text: "IFCTEXT", Label: "IFCLABEL", Identifier: "IFCIDENTIFIER" };

const INFO = { title: "NRC analytics property sets", author: "cdiggins@gmail.com", date: "2026-09-27" };

/** RFC 4180 rows as objects keyed by the header: quoted fields may hold commas and doubled quotes. */
function readCsv(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])));
}

const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The element-level dictionary row of each specification's metric; fails on a missing row or an unknown value type. */
function requirements(metrics) {
  return SPECIFICATIONS.map(({ name, metricId }) => {
    const row = metrics.find((m) => m.MetricId === metricId && m.Level === "element");
    if (!row) throw new Error(`${METRICS_CSV} has no element-level row for ${metricId} (specification ${name})`);
    const dataType = DATA_TYPES[row.ValueType];
    if (!dataType) throw new Error(`${metricId}: ValueType ${row.ValueType} has no IDS dataType in DATA_TYPES`);
    return { name, propertySet: row.PropertySet, property: row.PropertyName, dataType };
  });
}

/** Fails when ANALYSED_CLASSES is not exactly the set of classes with rows in the long table. */
function checkClasses(longRows) {
  const inData = [...new Set(longRows.map((r) => r.IfcClass))].sort();
  const listed = [...ANALYSED_CLASSES].sort();
  if (inData.join() !== listed.join())
    throw new Error(`ANALYSED_CLASSES (${listed.join(", ")}) differs from the IfcClass values in ${LONG_CSV} (${inData.join(", ")})`);
}

function render(specs) {
  const required = specs.map((s) => `${s.propertySet}.${s.property}`).join(" and ");
  const description = `Every analysed element (the ${words(ANALYSED_CLASSES.length)} IFC classes carrying a row in nrc_analytics_long.csv) `
    + `must carry ${required} ${specs.every((s) => s.dataType === "IFCREAL") ? "as real numbers" : "with the dataType each requirement names"}. `
    + `Generated from samples/nrc/nrc-metrics.csv.`;
  const enumeration = ANALYSED_CLASSES.map((c) => `\t\t\t\t\t\t\t<xs:enumeration value="${xml(c)}"/>`);
  const specification = (s) => [
    `\t\t<specification name="${xml(s.name)}" ifcVersion="IFC4">`,
    `\t\t\t<applicability minOccurs="1" maxOccurs="unbounded">`,
    `\t\t\t\t<entity>`,
    `\t\t\t\t\t<name>`,
    `\t\t\t\t\t\t<xs:restriction base="xs:string">`,
    ...enumeration,
    `\t\t\t\t\t\t</xs:restriction>`,
    `\t\t\t\t\t</name>`,
    `\t\t\t\t</entity>`,
    `\t\t\t</applicability>`,
    `\t\t\t<requirements>`,
    `\t\t\t\t<property dataType="${s.dataType}">`,
    `\t\t\t\t\t<propertySet>`,
    `\t\t\t\t\t\t<simpleValue>${xml(s.propertySet)}</simpleValue>`,
    `\t\t\t\t\t</propertySet>`,
    `\t\t\t\t\t<baseName>`,
    `\t\t\t\t\t\t<simpleValue>${xml(s.property)}</simpleValue>`,
    `\t\t\t\t\t</baseName>`,
    `\t\t\t\t</property>`,
    `\t\t\t</requirements>`,
    `\t\t</specification>`,
  ];
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd">`,
    `\t<info>`,
    `\t\t<title>${xml(INFO.title)}</title>`,
    `\t\t<description>${xml(description)}</description>`,
    `\t\t<author>${xml(INFO.author)}</author>`,
    `\t\t<date>${INFO.date}</date>`,
    `\t</info>`,
    `\t<specifications>`,
    ...specs.flatMap(specification),
    `\t</specifications>`,
    `</ids>`,
    ``,
  ].join("\n");
}

/** English words for the class count in the description; digits past twenty. */
function words(n) {
  const names = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
    "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  return names[n] ?? String(n);
}

function main(args) {
  checkClasses(readCsv(LONG_CSV));
  const text = render(requirements(readCsv(METRICS_CSV)));
  if (args.includes("--check")) {
    // Line endings are compared as LF: git stores the file with LF, and a checkout may convert them.
    const committed = readFileSync(IDS_FILE, "utf8").replace(/\r\n/g, "\n");
    if (committed !== text) {
      console.error(`${IDS_FILE} differs from what nrc-metrics.csv gives; run node scripts/nrc-ids.mjs`);
      return 1;
    }
    console.log(`${IDS_FILE} matches nrc-metrics.csv`);
    return 0;
  }
  const out = args.includes("--out") ? resolve(args[args.indexOf("--out") + 1]) : IDS_FILE;
  writeFileSync(out, text);
  console.log(`wrote ${out}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
