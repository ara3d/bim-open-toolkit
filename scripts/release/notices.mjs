// Third-party notices for the release: THIRD-PARTY-NOTICES.md, and a licenses/ folder holding the licence
// text each bundled dependency ships with. Three sources:
//   NuGet packages  every package the published projects restored (obj/*/project.assets.json), with the
//                   licence the package declares and its LICENSE file when it has one
//   the runtime     the .NET and ASP.NET runtime packs the self-contained publish copied into bin/
//   npm packages    every package the built web pages bundle, found from the source maps of the build
// plus the native libraries and sample models that carry no package metadata, listed by hand below.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { filesUnder } from "./lib.mjs";

/** Bundled files no package manager describes: what they are, their licence, and where the licence text is. */
const MANUAL = [
  { name: "web-ifc native library (web-ifc-library.dll)", license: "MPL-2.0", url: "https://github.com/ThatOpen/engine_web-ifc",
    note: "Mozilla Public License 2.0. Source: the URL above; the build is the one Ara3D.IfcLoader ships." },
  { name: "DuckDB (inside DuckDB.NET.Data.Full)", license: "MIT", url: "https://github.com/duckdb/duckdb" },
  { name: "Duplex Apartment test files (samples/nrc, samples/public)", license: "CC-BY-4.0",
    url: "https://creativecommons.org/licenses/by/4.0/", note: "BSI (2020), buildingSMART International; see samples/nrc/NOTICE.md and samples/public/NOTICE.md." },
];

const nugetRoot = join(process.env.NUGET_PACKAGES ?? join(homedir(), ".nuget", "packages"));

const text = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
const tag = (xml, name) => xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, "i"))?.[1]?.trim();

/** The licence files at the top of a package folder, e.g. LICENSE, LICENSE.txt, license.md. */
const licenseFiles = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f) && !f.endsWith(".nuspec")) : [];

function copyLicenses(from, to, extra = []) {
  const names = [...licenseFiles(from), ...extra.filter((e) => existsSync(join(from, e)))];
  for (const name of new Set(names)) {
    mkdirSync(to, { recursive: true });
    copyFileSync(join(from, name), join(to, basename(name)));
  }
  return names.length;
}

/** Every NuGet package id and version the given projects restored, from their project.assets.json. */
function nugetPackages(buildDir, projects) {
  const found = new Map();
  for (const project of projects) {
    const assets = join(buildDir, "obj", project, "project.assets.json");
    if (!existsSync(assets)) continue;
    for (const key of Object.keys(JSON.parse(readFileSync(assets, "utf8")).libraries ?? {})) {
      const [id, version] = key.split("/");
      found.set(`${id}/${version}`, { id, version });
    }
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function nugetRows(layout, packages) {
  return packages.flatMap(({ id, version }) => {
    const dir = join(nugetRoot, id.toLowerCase(), version);
    if (!existsSync(dir)) return []; // a project reference, not a package
    const nuspec = text(join(dir, `${id}.nuspec`)) || text(join(dir, `${id.toLowerCase()}.nuspec`));
    const license = tag(nuspec, "license") ?? (tag(nuspec, "licenseUrl") ? `see ${tag(nuspec, "licenseUrl")}` : "not declared");
    const fileLicense = nuspec.match(/<license type="file">([^<]+)</)?.[1];
    copyLicenses(dir, join(layout, "licenses", "nuget", `${id}-${version}`), fileLicense ? [fileLicense] : []);
    return [{ name: `${id} ${version}`, license, url: tag(nuspec, "projectUrl") ?? `https://www.nuget.org/packages/${id}/${version}` }];
  });
}

/** The runtime packs the publish copied (runtimepack.* libraries in a deps.json), with their licence and notices files. */
function runtimeRows(layout) {
  const deps = join(layout, "bin", "bimopenflow-studio.deps.json");
  const libraries = existsSync(deps) ? Object.keys(JSON.parse(readFileSync(deps, "utf8")).libraries ?? {}) : [];
  return libraries.filter((k) => k.startsWith("runtimepack.")).flatMap((key) => {
    const [pack, version] = key.replace("runtimepack.", "").split("/");
    const dir = join(nugetRoot, pack.toLowerCase(), version);
    copyLicenses(dir, join(layout, "licenses", "dotnet", pack), ["THIRD-PARTY-NOTICES.TXT", "THIRD-PARTY-NOTICES.txt"]);
    return [{ name: `${pack} ${version}`, license: "MIT", url: "https://github.com/dotnet/runtime" }];
  });
}

/**
 * The npm packages the web build bundled: the node_modules/<package> paths named in the `sources` of its
 * source maps. Each is looked up in `searchRoots` for its package.json and licence files.
 */
export function bundledNpmPackages(mapDirs) {
  const names = new Set();
  for (const dir of mapDirs)
    for (const file of filesUnder(dir).filter((f) => f.endsWith(".js.map")))
      for (const source of JSON.parse(readFileSync(join(dir, file), "utf8")).sources ?? [])
        for (const m of source.matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)\//g)) names.add(m[1]);
  return [...names].sort();
}

function npmRows(layout, names, searchRoots) {
  return names.flatMap((name) => {
    const dir = searchRoots.map((r) => join(r, name)).find((d) => existsSync(join(d, "package.json")));
    if (!dir) return [{ name, license: "not found in node_modules", url: "" }];
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    copyLicenses(dir, join(layout, "licenses", "npm", name.replace("/", "__")));
    const license = typeof pkg.license === "string" ? pkg.license : pkg.license?.type ?? (pkg.licenses ?? []).map((l) => l.type).join(" OR ");
    return [{ name: `${name} ${pkg.version}`, license: license || "not declared", url: pkg.homepage ?? pkg.repository?.url ?? `https://www.npmjs.com/package/${name}` }];
  });
}

const table = (title, rows) =>
  rows.length === 0
    ? ""
    : `## ${title}\n\n| Component | Licence | Source |\n|---|---|---|\n${rows.map((r) => `| ${r.name} | ${r.license} | ${r.url}${r.note ? ` (${r.note})` : ""} |`).join("\n")}\n\n`;

/** Writes the notices into the layout; `npmNames` come from bundledNpmPackages. Returns the counts, for the build log. */
export function writeNotices(layout, root, { buildDir, projects, npmNames = [], npmRoots = [] }) {
  copyFileSync(join(root, "LICENSE"), join(layout, "LICENSE"));
  copyFileSync(join(root, "NOTICE.md"), join(layout, "NOTICE.md"));
  const nuget = nugetRows(layout, nugetPackages(buildDir, projects));
  const runtime = runtimeRows(layout);
  const npm = npmRows(layout, npmNames, npmRoots);
  writeFileSync(join(layout, "THIRD-PARTY-NOTICES.md"),
    "# Third-party notices\n\nBIM Open Toolkit is MIT licensed (LICENSE). This release also carries the components below, each under its own licence; "
    + "the licence texts that came with them are in the licenses folder, and NOTICE.md lists the building models.\n\n"
    + table(".NET runtime", runtime) + table("NuGet packages", nuget) + table("npm packages bundled in the web pages", npm)
    + table("Other components", MANUAL));
  return { nuget: nuget.length, runtime: runtime.length, npm: npm.length };
}
