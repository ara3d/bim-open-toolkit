# samples/nrc/ids

Two IDS (Information Delivery Specification, buildingSMART's XML format for model requirements)
files the `ids.check` node reads over the Duplex. The graphs in `samples/checking-analyses` use
both.

| File | Specifications | Made by |
|---|---|---|
| `nrc-analytics.ids` | `IDS-OC` and `IDS-EC`: every element of the fourteen analysed IFC classes carries `NRC_OperationalCarbon.OperationalCarbon_kgCO2e_per_year` and `NRC_EmbodiedCarbon.EmbodiedCarbon_A1A3_kgCO2e` as `IFCREAL` | `scripts/nrc-ids.mjs`, from `../nrc-metrics.csv` |
| `dc-w1.ids` | rule DC-W1, door leaf width at least 850 mm | by hand |

Regenerate `nrc-analytics.ids` after a change to the metric dictionary:

    node scripts/nrc-ids.mjs           # rewrites nrc-analytics.ids
    node scripts/nrc-ids.mjs --check   # exits 1 if the committed file is stale

The dictionary gives each requirement's property set, property name, and data type. The
script's header says what it does not: which metrics become specifications, their names, and
the IFC class list, which it checks against the `IfcClass` column of
`../nrc_analytics_long.csv`.

The script refuses a dictionary that would give a requirement accepting anything. It exits 1,
with the reason on stderr, when the header lacks `MetricId`, `Level`, `PropertySet`,
`PropertyName`, or `ValueType`; when an element-level row has an empty `PropertySet` or
`PropertyName` (the message names the row); or when a metric has more than one element-level row.
`node --test scripts/nrc-ids.test.mjs` covers these.

Both files are also bim-open-data's test fixtures, in `tests/data/Ara3D.Ids.Tests/ids` there;
a change here is copied there in the same change. `IdsFilesTests` in
`tests/studio/BimOpenFlow.NrcWorkflows.Tests` fails when the generated file is stale or when
either file differs from its copy.
