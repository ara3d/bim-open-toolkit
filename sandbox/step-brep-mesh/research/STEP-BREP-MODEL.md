# The STEP boundary-representation model, for the layers that read it

Written 2026-10-17 for the design pass of TKT-299 (the STEP B-rep to mesh library, see
[../README.md](../README.md)). The authors of `01-geometry`, `02-topology` and `03-step` learn STEP
from this document only. It states what the standard says, what real files do, and what
OpenCascade (the most widely used open-source STEP reader) does when the two differ. It does not
redesign the layers: where a fact bears on a fixed name in [../VOCABULARY.md](../VOCABULARY.md), the
text says which name and how.

Every rule carries a source key and a clause. A claim that could not be checked against a source is
marked **(unconfirmed)**. A claim that rests on the file survey of section 6.1 is marked
**[Survey]**, and holds for that sample only.

## Sources

| Key | Document | Where it was read |
|---|---|---|
| P21 | ISO 10303-21:2016, edition 3, final text: the clear-text encoding (the "Part 21 file") | <https://www.steptools.com/stds/step/IS_final_p21e3.html> |
| P42 | ISO 10303-42:2021, geometric and topological representation. Clause 4 is the geometry schema, clause 5 topology, clause 6 the geometric model schema | STEP Tools copy of the STEP module and resource library (SMRL): <https://www.steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/4_schema.htm> (and `5_schema.htm`, `6_schema.htm`); EXPRESS listings `.../data/resources/geometry_schema/geometry_schema.exp`, `topology_schema.exp`, `geometric_model_schema.exp` |
| P43 | ISO 10303-43:2021, representation structures | `.../resource_docs/representation_structures/sys/4_schema.htm`; `.../resources/representation_schema/representation_schema.exp` |
| P41 | ISO 10303-41, measure schema (units) | `.../resources/measure_schema/measure_schema.exp` |
| P11 | ISO 10303-11:2004, the EXPRESS language | not available online; clause numbers given from memory are marked (unconfirmed) |
| AIM | The AP242 integrated schema as published by STEP Tools ("step_merged_ap_schema"), which also marks where AP203 edition 2 and AP214 differ | `https://www.steptools.com/stds/stp_aim/html/t_<entity>.html`, for example [t_advanced_face.html](https://www.steptools.com/stds/stp_aim/html/t_advanced_face.html) |
| AIC | The interpreted constructs that define `advanced_face` (ISO 10303-511 topologically bounded surface) and `advanced_brep_shape_representation` (ISO 10303-514) | `.../resources/aic_topologically_bounded_surface/aic_topologically_bounded_surface.exp`, `.../resources/aic_advanced_brep/aic_advanced_brep.exp` |
| SN | ISO's table of entity short names (P42 Annex A points to it) | <https://standards.iso.org/iso/10303/tech/short_names/short-names.txt> |
| PDMUG | PDM Schema Usage Guide, release 4.3 (2002), PDM-IF; still the reference for product structure and assembly placement | <https://www.mbx-if.org/home/wp-content/uploads/2024/05/pdmug_release4_3.pdf> |
| UDA | CAx-IF Recommended Practices for User Defined Attributes v1.8 (2021), Annex C "Definition of units" | <https://www.mbx-if.org/home/wp-content/uploads/2024/05/rec_prac_user_def_attributes_v18.pdf> |
| STY | CAx-IF Recommended Practices for Model Styling and Organization v1.10 (2025) | <https://www.mbx-if.org/home/wp-content/uploads/2026/08/rec_prac_styling_org_v1.10.pdf> |
| GVP | CAx-IF Recommended Practices for Geometric and Assembly Validation Properties v4.6 (2023) | <https://www.mbx-if.org/home/wp-content/uploads/2024/05/rec_prac_gvp_v46.pdf> |
| OCC | OpenCascade Technology source, commit `3d097a03` (2026-08-24), directory `src/DataExchange/TKDESTEP/` | <https://github.com/Open-Cascade-SAS/OCCT> |
| Survey | Scripts run for this document over 103 files: 88 from the u-blox 3D-Step-Models-Library and 1 from NASA 3D Resources (SolidWorks, Creo, Spatial InterOp, OpenCascade, Autodesk exporters; local copies under `C:\Users\cdigg\git\3d-format-shootout\data\submodules\`), 12 STEP Tools samples (Unigraphics, Pro/ENGINEER, CATIA V4, CADDS 5, ACIS, Euclid, Theorem) and the 2 OpenCascade data samples | section 6.1 |

The CAx Interoperability Forum (CAx-IF, now part of the MBx Interoperability Forum) publishes no
recommended practice for B-rep geometry itself: its current list
(<https://www.mbx-if.org/home/?p=194>, checked 2026-10-17) covers styling, validation properties,
PMI, tessellation, assembly structure in XML, and others, but nothing on seams, poles, pcurves, or
tolerances. Where this document needs a convention for those, it uses the standard, OpenCascade's
source, and the survey, and says which.

## Edition and naming notes

- ISO 10303-42 has been revised several times; the clause numbers here are those of the 2021 text.
  AP203 edition 1 (`CONFIG_CONTROL_DESIGN`), AP214 (`AUTOMOTIVE_DESIGN`), AP203 edition 2, and AP242
  embed older or newer versions of the same entities. Computed by script from the long-form schemas
  of AP242 edition 3, AP214 edition 3 and AP203 edition 2, the Part 21 record of every entity in this
  document is the same in all three, with one exception, `conversion_based_unit` (section 2.4); the
  `advanced_face` and `advanced_brep_shape_representation` rules are identical too. AP203 edition 1
  (`CONFIG_CONTROL_DESIGN`) was not compared (unconfirmed), though OpenCascade reads it with the same
  reader classes.
- EXPRESS fragments quoted below come from the ISO EXPRESS listings, which ISO distributes with a
  licence permitting copying for implementation. Prose rules are paraphrased.
- "Model units" means the length unit assigned by the geometric representation context; "angle
  units" means its plane-angle unit (section 3.1).

## Facts that shape the three layers

Read these first; each is argued, with its source, further down.

1. **Angular parameters are in the file's plane-angle unit, and many files use degrees.** Circle and
   cylinder parameters, cone semi-angles, trimming parameters on conics, and pcurve coordinates on
   angular surfaces are "angular parameters" whose numeric values use the context's plane-angle
   unit [P42 4.2.3]. Nine of the 12 STEP Tools samples and both Creo files (2020, 2022) assign
   `DEGREE` [Survey]: a Unigraphics file writes `CONICAL_SURFACE('',#100,122.7375,45.)`. The decoder
   converts every angle to radians once, at decode time, and nothing downstream sees degrees
   (section 5.1).
2. **A `conical_surface`'s v parameter is the axial coordinate, not the slant length**:
   σ(u,v) = C + (R + v tan α)(cos u·x + sin u·y) + v·z [P42 4.5.61]. OpenCascade's cone uses slant
   length and multiplies every pcurve v by 1/cos α on import [OCC GeomConvert_Units.cxx]. Our natural
   parameterization must be ISO's, or pcurves on cones are wrong.
3. **Edge parameter ranges are not in the file.** An `edge_curve` names a possibly unbounded curve
   and two vertices; the edge's interval is found by projecting the vertex points onto the curve
   [P42 5.5.5 edge_geometry; OCC StepToTopoDS_TranslateEdge.cxx MakeFromCurve3D]. The geometry layer
   needs inverse evaluation on curves as a first-class operation, and the decoder's result is only as
   good as that projection within the file's uncertainty.
4. **Direction along a curve and side of a face are four booleans composed.** The coedge runs with
   increasing curve parameter iff the product σ(edge_curve.same_sense)·σ(oriented_edge.orientation)·
   σ(face_bound.orientation) is +1, and the face interior lies to the left of the coedge in the
   surface's (u,v) plane iff σ(face_surface.same_sense) is +1, with a single exception, the inner part
   of a degenerate torus, whose normal is defined the other way (section 4). Oriented faces and
   oriented shells reverse both normal and loops, so they never change the left/right rule.
5. **Periodic faces come in three shapes, and seams are optional.** A full cylindrical band may be
   bounded by a seam edge used twice with opposite orientations (OpenCascade: 521 of 1,971 cylinder
   faces; Autodesk; Euclid), by two circular loops and no seam (Spatial 236 faces, SolidWorks 29,
   Unigraphics 24), or the exporter splits it into faces that each span less than a period (most
   faces of every exporter, and all of Creo's) [Survey; P42 5.5.18 example 2]. The face-meshing layer
   must cut its own seam when the file has none.
6. **Poles and apexes are never edges.** STEP forbids degenerate (zero-length) edges [P42 5.2.2,
   5.5.5 IP2], so a pole is a vertex where seam or meridian edges meet (SolidWorks: 132 of 150 sphere
   faces), a `vertex_loop` bound (OpenCascade, Unigraphics), a point inside a face bounded by a single
   loop that wraps the period (Spatial: a hemisphere bounded by its equator), or the inside of a face
   whose only bound is a `vertex_loop` (a complete sphere) [P42 5.5.14, 5.5.19; Survey]. The face
   mesher has to recover the degenerate side of the (u,v) rectangle itself.
7. **pcurves are optional, sometimes the master, and need not share the 3D curve's
   parameterization.** `surface_curve.master_representation` names which of curve_3d, pcurve 1, or
   pcurve 2 defines the parameterization [P42 4.2.6, 4.5.49]. OpenCascade 6.2 and 7.3 write
   `PCURVE_S1`, Euclid and CAS.CADE `PCURVE_S2`, ACIS `CURVE_3D`; SolidWorks, Creo, Spatial,
   Unigraphics, Pro/ENGINEER, Autodesk and OpenCascade 6.8 and 7.5 write no pcurves at all
   [Survey]. AP242 does not require them (section 6.4). The pipeline must work from 3D curves alone
   and may use pcurves as hints, never as the only path.
8. **Files break the rules in a few predictable ways.** Complex instances out of alphabetical
   order (Spatial: 934 instances), `NAMED_UNIT(#n)` where the rule demands `*`, lower-case schema
   names, line breaks inside strings, entity short names (a CATIA V4 file uses `CRTPNT` for
   `cartesian_point`), two `face_outer_bound`s on one face (259 faces), `closed_shell`s with free edges
   (371), and uncertainties from 1e-13 mm to 0.67 mm [Survey]; OpenCascade also guards against
   toroidal surfaces with a negative major radius, which it reads as a reversed face [OCC
   StepToTopoDS_TranslateFace.cxx]. The decoding layer must accept these with diagnostics, not fail
   (section 6.6).

## 1. The Part 21 physical file

ISO 10303-21 defines a clear-text encoding of instances of an EXPRESS schema. Edition 1 dates from
1994 and edition 2 from 2002 [P21 8.2.2 NOTE 2]; edition 3 from 2016 (year unconfirmed).
Everything in this section holds in all three editions unless marked as an edition 3 addition.

### 1.1 Skeleton

```
ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('description line', ...), '2;1');
FILE_NAME('name', '2026-10-17T12:00:00', ('author'), ('organization'),
          'preprocessor version', 'originating system', 'authorization');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
#10=CARTESIAN_POINT('',(0.,0.,0.));
#11=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );
...
ENDSEC;
END-ISO-10303-21;
```

- The file opens with the special token `ISO-10303-21;` and closes with `END-ISO-10303-21;`; the
  header section follows the opening token [P21 5.5 Table 3, 6.2].
- The header holds exactly one `FILE_DESCRIPTION`, one `FILE_NAME`, one `FILE_SCHEMA`, in that order
  [P21 8.1]. Their attributes [P21 8.2.2 to 8.2.4]:
  - `FILE_DESCRIPTION(description: LIST[1:?] OF STRING(256), implementation_level: STRING(256))`.
    `'2;1'` declares edition 1 conformance class 1, `'3;1'` edition 2 class 1, `'4;1'`, `'4;2'`,
    `'4;3'` the three edition 3 classes. Real files also write `'1'` (SolidWorks, Spatial, Euclid,
    CATIA) [Survey]; the reader must not depend on it.
  - `FILE_NAME(name, time_stamp, author: LIST, organization: LIST, preprocessor_version,
    originating_system, authorization)`. Only `name` and `time_stamp` have defined content.
    `originating_system` and `preprocessor_version` identify the exporter and are worth keeping in
    diagnostics, because exporter-specific repairs key on them.
  - `FILE_SCHEMA(schema_identifiers: LIST[1:?] OF UNIQUE STRING)`. Names are upper case, optionally
    followed by an object identifier in braces [P21 8.2.4]. Names met in practice:
    `CONFIG_CONTROL_DESIGN` (AP203 edition 1), `AUTOMOTIVE_DESIGN` and `AUTOMOTIVE_DESIGN_CC1`
    (AP214), `AP203_CONFIGURATION_CONTROLLED_3D_DESIGN_OF_MECHANICAL_PARTS_AND_ASSEMBLIES_MIM_LF`
    (AP203 edition 2), `AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF` (AP242). Spatial writes
    `'automotive_design'` in lower case [Survey], against the rule.
- A single data section opens with `DATA;` and closes with `ENDSEC;` [P21 11.1].

### 1.2 Tokens and separators

| Item | Lexical form | Source |
|---|---|---|
| Separator | Only the space character separates tokens. Carriage return, line feed, tab and other control characters are ignored wherever they occur, even inside a token or a string, so a line break may fall anywhere. | P21 5.2, 5.6 NOTE |
| Comment | `/*` ... `*/`, not nested, allowed wherever a separator is | P21 5.6 |
| Keyword | Upper-case letters, digits and `_`, starting with a letter (an entity or defined-type name); `!NAME` is a user-defined keyword | P21 6.3, Table 2 |
| Integer | `[+|-]digits`, base 10; `012` is 12 | P21 6.4.1 |
| Real | `[+|-]digits.digits*[E[+|-]digits]`: at least one digit before the point, the point is required, the exponent letter is a capital E. Valid: `0.`, `1.5`, `-32.178E+02`, `1.E-07`, `0.E25`. Invalid: `.5`, `1E05`, `1`, `1,000.0` | P21 6.4.2 |
| String | `'...'`; an apostrophe inside is written `''`, a reverse solidus `\\`. `\S\c` adds 128 to the code of character c (ISO 8859 page); `\PA\` to `\PI\` select the ISO 8859 part for later `\S\`; `\X\hh` one code point U+0000 to U+00FF; `\X2\hhhh...\X0\` code points as 4 hex digits each; `\X4\hhhhhhhh...\X0\` as 8 hex digits each. Edition 3 also allows UTF-8 directly. Maximum 32,769 octets including the apostrophes | P21 6.4.3 |
| Print controls | `\N\` and `\F\` inside strings or between tokens; they do not contribute to the value | P21 13 |
| Enumeration | `.NAME.`: upper-case letters, digits, `_`, starting with a letter. BOOLEAN is `.T.`/`.F.`; LOGICAL adds `.U.` | P21 6.4.5, 12.1.1.3, 12.1.1.4 |
| Binary | `"` then one hex digit giving the count (0 to 3) of zero bits padded on the left, then hex digits, then `"`; `"0"` is empty | P21 6.4.6 |
| Entity reference | `#` followed by digits, at least one non-zero; leading zeros do not count (`#001` is `#1`) | P21 6.4.4.3 |
| Unset | `$`: no value for an OPTIONAL attribute (also used for an absent OPTIONAL aggregate: never `()` for "absent") | P21 6.2, 12.2.2, 12.1.2 NOTE |
| Derived | `*`: a supertype attribute that a subtype redeclares as DERIVE | P21 6.2, 12.2.6 |
| Typed parameter | `KEYWORD(value)`: a value of a SELECT whose chosen member is a defined type or enumeration, for example `LENGTH_MEASURE(1.E-07)`, `PARAMETER_VALUE(0.5)` | P21 7.1, 12.1.8 |
| List | `( p1, p2, ... )`, possibly empty, nestable; LIST, SET, BAG and ARRAY all use it. A multidimensional ARRAY (or LIST OF LIST) is a list of lists, rightmost index varying fastest | P21 7.1, 12.1.2 to 12.1.5 |

Deviations a reader meets [Survey; OCC StepFile/step.lex]:

- Line breaks inside strings: Euclid and ST-ACIS files split `'distance_accuracy_value'` across
  lines. Per P21 5.6 the line break is dropped, so the value is unchanged. OpenCascade's lexer keeps
  newlines inside strings (it counts them) (from the lexer rules; whether the character survives into
  the value is unconfirmed).
- OpenCascade's lexer accepts entity keywords in lower case, a real such as `.5` (any run of two or
  more digits and points), and recognises a string end as an apostrophe followed by optional spaces
  and `,` or `)`; it requires an upper-case exponent letter. Being as lenient is cheap and avoids
  rejecting files OpenCascade reads.

### 1.3 Entity instances

```
#12 = LINE('', #10, #11);                                      simple instance
#13 = ( BOUNDED_CURVE() B_SPLINE_CURVE(2,(#1,#2,#3),.UNSPECIFIED.,.F.,.F.)
        B_SPLINE_CURVE_WITH_KNOTS((3,3),(0.,1.),.UNSPECIFIED.) CURVE()
        GEOMETRIC_REPRESENTATION_ITEM() RATIONAL_B_SPLINE_CURVE((1.,0.707106781,1.))
        REPRESENTATION_ITEM('') );                             complex instance
```

- **Numbering.** Each instance has a name unique in the file; names need not be dense or ordered,
  and a reference may come before the instance it names [P21 11.2, 6.4.4.3]. 22 of the 103 surveyed
  files have gaps in their numbering [Survey]. The decoder therefore resolves references in a second
  pass, through a map from instance name to arena index (`ProvenanceMap` in the vocabulary).
- **Simple instance (internal mapping).** When the instance's set of entity types has exactly one
  leaf (an entity type none of whose subtypes is also in the set), it is written as one record named
  after the leaf. Its parameters are all explicit attributes of all its supertypes and of the leaf, in
  this order: a supertype's attributes come before its subtypes'; with several supertypes, in the
  order of the SUBTYPE OF clause, depth first; a supertype reached twice contributes once
  [P21 12.2.5.1, 12.2.5.2]. Example: `edge_curve` is SUBTYPE OF (edge, geometric_representation_item),
  so `EDGE_CURVE(name, edge_start, edge_end, edge_geometry, same_sense)`: `name` from
  representation_item, the vertices from edge, nothing from geometric_representation_item, then its
  own two.
- **Complex instance (external mapping).** When the set has two or more leaves, the instance is
  written as `( record record ... )`, one record per entity type in the set, including types with no
  attributes (they appear as `CURVE()`). Each record carries only the explicit attributes declared in
  that entity. Records are sorted in ascending order of the long entity name compared octet by octet
  [P21 12.2.5.3]. Because `_` (0x5F) sorts after the letters, `BOUNDED_CURVE` precedes
  `B_SPLINE_CURVE`, and `SI_UNIT` precedes `SOLID_ANGLE_UNIT`.
- **Short names.** A schema may define short names (for example `CRTPNT` for `cartesian_point`), and
  a file may use them in place of entity and type names [P21 12.2.11, 12.1.7, 12.1.8]. Records of a
  complex instance are still sorted by the long names [P21 12.2.5.3 NOTE 1]. The table is
  <https://standards.iso.org/iso/10303/tech/short_names/short-names.txt> [SN]; a CATIA V4 sample uses
  short names throughout, for example `#28=(LNGUNT()NMDUNT(*)SUNT(.MILLI.,.METRE.));` [Survey,
  `clip.stp`]. The short names of the catalogue entities are listed in section 3.9.
- **Explicit attributes redeclared as DERIVE** in a subtype are written `*` in the supertype's
  position [P21 12.2.6]. The cases that matter here: `oriented_edge` (edge_start, edge_end),
  `oriented_face` (bounds), `oriented_closed_shell` and `oriented_open_shell` (cfs_faces), `si_unit`
  (named_unit.dimensions), and, in AP214 only, `conversion_based_unit` (named_unit.dimensions; it is
  explicit in AP203 edition 2 and AP242) [computed from the three long-form schemas, section 2.4].
- Derived and inverse attributes and WHERE and UNIQUE rules are never written [P21 12.2.3, 12.2.9,
  12.2.10].

Deviations [Survey]:

- Spatial InterOp writes complex units out of order, `(NAMED_UNIT(#1079)SOLID_ANGLE_UNIT()SI_UNIT($,.STERADIAN.))`
  (934 such instances in 18 files), and writes `NAMED_UNIT(#n)` beside `SI_UNIT` where the rule
  demands `*`. Decode complex instances by the set of record names, never by position, and accept a
  value where `*` is expected.
- The usual complex instances in a B-rep file are: rational B-spline curves and surfaces (as above);
  the 3D context `( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#u))
  GLOBAL_UNIT_ASSIGNED_CONTEXT((#l,#a,#s)) REPRESENTATION_CONTEXT('','') )`; the 2D parameter-space
  context `( GEOMETRIC_REPRESENTATION_CONTEXT(2) PARAMETRIC_REPRESENTATION_CONTEXT()
  REPRESENTATION_CONTEXT('','') )`; units; and the assembly link
  `( REPRESENTATION_RELATIONSHIP('','',#rep1,#rep2) REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#t)
  SHAPE_REPRESENTATION_RELATIONSHIP() )` [Survey; PDMUG 3.3.1.2 Example 13].

### 1.4 Edition 2 and 3 additions, out of scope

Edition 3 adds an anchor section (`ANCHOR;`, names for instances that other files may reference), a
reference section (`REFERENCE;`, instances defined in other files), value instance names `@n`,
references to EXPRESS constants (`#NAME`, `@NAME`), several named data sections
(`DATA('name',('SCHEMA'));`), signature sections after `END-ISO-10303-21;`, header entities
`SCHEMA_POPULATION`, `FILE_POPULATION`, `SECTION_LANGUAGE`, `SECTION_CONTEXT`, and a ZIP container
[P21 4.3, 5.3, 8.2.5 to 8.2.8, 9, 10, 11.1, 14, Annex A.4]. Edition 1 also had a scope structure
(`&SCOPE` ... `ENDSCOPE`), which OpenCascade's lexer still recognises [OCC step.lex] (edition 1
content unconfirmed). None of these appeared in the survey. The decoding layer should parse the
section keywords far enough to report "unsupported section" as a diagnostic and decode the rest; it
need not resolve anchors or references.

## 2. EXPRESS, as far as the decoding layer must model it

EXPRESS (ISO 10303-11) is the schema language every application protocol (AP) is written in. The
decoding layer does not need an EXPRESS compiler. It needs a data model of the roughly 90 entities of
section 3 that answers three questions: which attributes an instance carries and in what order, what
type each attribute has, and which rules an instance must satisfy. P11 clause numbers below are from
memory and **(unconfirmed)**; the behaviour they describe is confirmed by how P21 maps it.

### 2.1 Declarations

| Construct | Meaning | Example from the B-rep schemas |
|---|---|---|
| `ENTITY e; a : T; END_ENTITY;` | A record type with named attributes (P11 9.2) | `ENTITY vector; orientation : direction; magnitude : length_measure; ...` |
| `SUBTYPE OF (s1, s2)` | Inheritance; an instance of e is also an instance of every supertype. Multiple supertypes are allowed (P11 9.2.3) | `edge_curve SUBTYPE OF (edge, geometric_representation_item)` |
| `SUPERTYPE OF (ONEOF(a, b))` | Constraint: an instance may be at most one of a, b (P11 9.2.5) | `conic SUPERTYPE OF (ONEOF(circle, ellipse, hyperbola, parabola))` |
| `SUPERTYPE OF (x ANDOR y)` | An instance may be x, y, or both at once, which is what produces complex instances | `b_spline_curve SUPERTYPE OF (ONEOF(uniform_curve, b_spline_curve_with_knots, quasi_uniform_curve, bezier_curve) ANDOR rational_b_spline_curve)` |
| Subtypes not named in any constraint | Implicitly ANDOR with each other (P11 9.2.5, unconfirmed clause) | `bounded_curve` is outside the ONEOF of `curve` [P42 4.5.32 NOTE] |
| `ABSTRACT SUPERTYPE` | Never instantiated by itself (P11 9.2.4) | `founded_item` in AP242 (supertype of `composite_curve_segment`, `surface_patch`). Some entities are abstract by rule or prose instead: `b_spline_curve` must carry one of its four knot subtypes by WHERE rule WR1 [P42 4.5.34]; `cartesian_transformation_operator` is instantiated only as a subtype [P42 4.5.20] |
| Explicit attribute | Stored in the file (P11 9.2.1.1) | `circle.radius` |
| `OPTIONAL` | May be unset, written `$` [P21 12.2.2] | `axis2_placement_3d.axis`, `.ref_direction` |
| `DERIVE` attribute | Computed from others, never stored (P11 9.2.1.2) | `axis2_placement_3d.p := build_axes(axis, ref_direction)` |
| `DERIVE SELF\super.a : T := ...` | Redeclares an inherited explicit attribute as computed; the file writes `*` in its slot [P21 12.2.6] | `oriented_edge`: `SELF\edge.edge_start := boolean_choose(...)` |
| `SELF\super.a : T2;` in the explicit list | Narrows the type of an inherited attribute; no effect on encoding [P21 12.2.8] | `shape_definition_representation`: `SELF\property_definition_representation.used_representation : shape_representation` |
| `INVERSE` attribute | The set of instances that reference this one through a named attribute; never stored [P21 12.2.10] | `representation_map.map_usage : SET[1:?] OF mapped_item FOR mapping_source` |
| `WHERE` (domain rule) | A Boolean condition each instance must satisfy (P11 9.2.2.2). It is violated only when it evaluates to FALSE; UNKNOWN (for example from an unset optional) does not violate it (unconfirmed clause) | `direction` WR1: some ratio is non-zero |
| `UNIQUE` | Attribute values that no two instances may share (P11 9.2.2.1) | `product_definition_formation` UR1: (id, of_product) |
| Global `RULE` | A condition over the whole population (P11 9.6) | `compatible_dimension` [P42 4.7.1] |

### 2.2 Types

| Construct | Meaning | Part 21 encoding |
|---|---|---|
| `INTEGER`, `REAL`, `NUMBER`, `STRING`, `BINARY` | Simple types | 6.4.1 to 6.4.6 |
| `BOOLEAN`, `LOGICAL` | TRUE/FALSE; TRUE/FALSE/UNKNOWN | `.T.` `.F.` `.U.` |
| Defined type `TYPE t = REAL; WHERE ...` | A named simple type, possibly with its own rule | As the underlying type, for example `positive_length_measure` is a REAL with WR1 `SELF > 0.0` [P41] |
| `ENUMERATION OF (a, b)` | Closed set of names | `.A.` [P21 12.1.7] |
| `SELECT (a, b)` | A tagged union of entities and defined types | An entity member as `#n`; a defined-type or enumeration member as `TYPENAME(value)` [P21 12.1.8]. Example: `trimming_select = SELECT (cartesian_point, parameter_value)` gives `(#5, PARAMETER_VALUE(0.5))` |
| `LIST [lo:hi] OF [UNIQUE] T` | Ordered; bounds on size; `?` is unbounded; UNIQUE forbids repeats | `( ... )` |
| `SET [lo:hi] OF T` | Unordered, no duplicates | `( ... )`; order in the file carries no meaning |
| `BAG [lo:hi] OF T` | Unordered, duplicates allowed | `( ... )` |
| `ARRAY [lo:hi] OF [OPTIONAL] [UNIQUE] T` | Fixed index range; elements may be `$` if OPTIONAL | `( ... )` |

Two consequences for the decoder:

- **SET order is not data.** `face.bounds`, `connected_face_set.cfs_faces`, `brep_with_voids.voids`
  and `representation.items` are SETs. Nothing may depend on the order they are written in; the
  outer loop is found from `face_outer_bound` or by geometry, never by position (section 6.6).
- **LIST order is data.** `path.edge_list` (the loop's edges, head to tail), `polyline.points`,
  `b_spline_curve.control_points_list`, the knot and multiplicity lists, and `poly_loop.polygon` are
  LISTs.

### 2.3 Rules the catalogue relies on

WHERE rules call EXPRESS functions. The ones a validator needs, with what they compute:

| Function | Computes | Source |
|---|---|---|
| `build_axes(axis, ref_direction)` | The orthonormal frame of an `axis2_placement_3d` (section 3.2) | P42 4.6.8 |
| `first_proj_axis(z, arg)`, `second_proj_axis(z, x, arg)` | Projection of a reference direction into the plane normal to z; defaults when absent | P42 4.6.23, 4.6.34 |
| `base_axis(dim, axis1, axis2, axis3)` | The matrix columns of a `cartesian_transformation_operator` | P42 4.6.6 |
| `constraints_param_b_spline(degree, up_knots, up_cp, mult, knots)` | Knot list consistency (section 5.3) | P42 4.6.11 |
| `default_b_spline_knots`, `default_b_spline_knot_mult` | The implied knots of uniform, quasi-uniform and Bézier splines | P42 4.6.18, 4.6.19 |
| `path_head_to_tail(p)` | Each oriented edge's end is the next one's start (instance equality) | P42 5.6.18 |
| `conditional_reverse`, `topology_reversed`, `edge_reversed`, `face_bound_reversed`, `face_reversed` | What "orientation = FALSE" means for each topological type | P42 5.6.3 to 5.6.7, 5.6.22 |
| `edge_curve_pcurves(edge, surface_curves)` | All pcurves attached to an edge (section 3.4, `surface_curve`) | P42 5.6.4 |
| `msb_shells(brep)` | Outer shell plus void shells of a solid | P42 6.5.6 |
| `mixed_loop_type_set(loops)` | True if poly_loops are mixed with other loop kinds | P42 5.6.16 |

Rules use instance equality `:=:` (same instance) and value equality `=`. `edge_loop` WR1 and
`path_head_to_tail` use `:=:`, so two distinct `vertex_point` instances at the same coordinates do
**not** satisfy them [P42 5.5.15, 5.6.18]. The decoder may merge such vertices as a repair (section
6.6), but it must report the merge, because the file as written is invalid.

### 2.4 The attribute order of a Part 21 record, and how to model it

The record of a simple instance lists the explicit attributes of the whole supertype graph, supertype
first, in SUBTYPE OF order, each supertype once; inherited attributes redeclared as DERIVE appear as
`*` [P21 12.2.5.2, 12.2.6]. For a complex instance, each record holds only the attributes declared
in its own entity [P21 12.2.5.3]. Section 3 gives the resulting record for every catalogue entity.
Those records were computed by a script from the three long-form schemas (AP242 edition 3 v1.152,
AP214 edition 3 2010, AP203 edition 2 2011, retrieved from the CAx-IF schema archive listed in [STY]
Annex A) and agree in all three schemas for all 153 entities checked, with one exception:
`conversion_based_unit` derives `named_unit.dimensions` in AP214 (written `*`) and stores it in AP203
edition 2 and AP242.

A schema model that suffices for decoding, in the vocabulary's terms (`EntityDefinition`,
`AttributeDefinition`, `AttributeKind`):

```
EntityDefinition { Name; ShortName; Supertypes: ordered; Explicit: Array<AttributeDefinition>;
                   DerivedRedeclarations: names of inherited explicit attributes written as '*' }
AttributeDefinition { Name; Kind; Optional: Boolean; Bounds (for aggregates); Unique: Boolean }
AttributeKind = Integer | Real | Logical | Boolean | String | Enumeration(values)
              | EntityRef(allowed entity names) | Select(members, typed-parameter names)
              | Aggregate(LIST|SET|BAG|ARRAY, element kind, lo, hi)
```

The flattened record (internal mapping) is then a function of the entity graph. Because there are
only about 90 entities and their records are fixed by ISO, the decoding layer can equally hold the
flattened records of section 3 as a literal table and test them against a list such as the one in
this document; the behaviour is the same.

Assigning a complex instance's attributes to parts: for each record in the complex instance, look up
the entity by (long or short) name and bind the record's parameters to that entity's own explicit
attributes in declaration order. The union of the records must be a set of types that EXPRESS
allows together (an "evaluated set" in P11 Annex B terms): for B-rep decoding it suffices to check
that every record names a known entity and that each known complex combination (section 1.3) is
complete.

## 3. The B-rep entity catalogue

Each entry gives: the clause; the short name [SN]; the supertype chain (leaf first); the Part 21
record of a simple instance, attributes in file order, `?` for OPTIONAL, `*` for a slot that is
always `*`; the WHERE rules, as formulas and in words; for geometry, the parameterization, domain,
period and degenerate boundaries; and the vocabulary case it decodes to, where one exists. Records
were computed from the long-form schemas (section 2.4) and checked against the attribute tables of
[AIM]. Every entity under `representation_item` has `name : label` first; `label` is a STRING, usually
`''` or `'NONE'`.

Notation: <v> is v normalized; σ_u, σ_v are partial derivatives; P42 4.2 Table 1 is the symbology.

### 3.1 Contexts and units

**`representation_context`** (P43 4.4.14; `RPRCNT`). Record `REPRESENTATION_CONTEXT(context_identifier: STRING, context_type: STRING)`. Inverse
`representations_in_context : SET[1:?] OF representation`. A context is a coordinate space; items in
representations with different contexts are unrelated unless a relationship says otherwise
[P43 4.2; P42 4.2.2].

**`geometric_representation_context`** (P42 4.5.1; `GMRPCN`). Chain: → representation_context.
Record `GEOMETRIC_REPRESENTATION_CONTEXT(context_identifier, context_type, coordinate_space_dimension: dimension_count)`;
`dimension_count` is an INTEGER with WR1 `SELF > 0` [P42 4.4.5]. Model space uses 3; the
parameter-space context of a pcurve uses 2 and is also a `parametric_representation_context`.
Global rule `compatible_dimension`: every geometric item founded in a context has that dimension
[P42 4.7.1].

**`parametric_representation_context`** (P43 4.4.12; `PRRPCN`). No attributes of its own. "Length
units are dimensionless" in it [P43 4.4.12 NOTE 2]. In files it is always part of a complex
instance with `geometric_representation_context(2)` [Survey].

**`global_uncertainty_assigned_context`** (P43 4.4.9; `GC`). Record adds `uncertainty : SET[1:?] OF uncertainty_measure_with_unit`.
Each uncertainty applies to every quantity of the same measure in representations using the context
[P43 4.4.9]. Always found as a part of the complex 3D context (section 1.3).

**`global_unit_assigned_context`** (P41 measure_schema; `GUAC`). Record adds `units : SET[1:?] OF unit`, where
`unit = SELECT (derived_unit, named_unit)`. In B-rep files the set holds one length unit, one
plane-angle unit, one solid-angle unit [Survey]. P42 gives no default when the plane-angle unit is
missing (unconfirmed); OpenCascade then assumes degrees [OCC STEPConstruct_UnitContext.cxx,
`planeAngleFactor = M_PI / 180.` before reading units].

**`measure_with_unit`** (P41; `MSWTUN`). Record `MEASURE_WITH_UNIT(value_component: measure_value, unit_component: unit)`.
`measure_value` is a SELECT of defined types, so the value is a typed parameter:
`LENGTH_MEASURE(25.4)`, `PLANE_ANGLE_MEASURE(0.0174532925199433)`. WR1 `valid_units(SELF)`.
Subtypes **`length_measure_with_unit`** (`LMWU`; WR1: unit_component is a `length_unit`) and
**`plane_angle_measure_with_unit`** (`PAMWU`; WR1: unit_component is a `plane_angle_unit`) add no
attributes.

**`uncertainty_measure_with_unit`** (P43 4.4.23; `UMWU`). Record
`UNCERTAINTY_MEASURE_WITH_UNIT(value_component, unit_component, name: label, description: text?)`.
WR1: a numeric value is positive. The name is free text: `'distance_accuracy_value'` (OpenCascade,
SolidWorks, Euclid, Unigraphics), `'closure'` (Pro/ENGINEER, ACIS), `'MODEL_ACCURACY'`
(Unigraphics 10.5), `'TOL_CRV'` (CATIA V4), `''` (Spatial) [Survey]. Values seen, converted to mm:
1e-13 (Theorem translator), 1e-7 to 5e-6 (OpenCascade; 1e-7 is what it writes by default), 1e-6
(ACIS, Euclid), 1e-5 (SolidWorks, all 41 files; Unigraphics 10.5 as 3.9e-7 inch), 2e-5
(Unigraphics, Euclid), 1e-4 (CADDS), 1e-3 (Spatial, written as 1e-6 m), about 0.004 (Creo 2020 to
2022, varying per part), 0.01 (Autodesk, Creo), 0.0254 (CADDS, 0.001 inch), 0.1 (CATIA V4), up to
0.67 (Pro/ENGINEER, 0.0265 inch, varying per part) [Survey]. Several uncertainties may be present;
OpenCascade takes the smallest, and treats its value as being in the context's length unit,
ignoring the unit it names [OCC STEPConstruct_UnitContext.cxx ComputeTolerance]. Convert through the
named unit instead (section 5.1).

**`named_unit`** (P41; `NMDUNT`). Record `NAMED_UNIT(dimensions: dimensional_exponents)`.
Supertype of `ONEOF(si_unit, conversion_based_unit, context_dependent_unit) ANDOR ONEOF(length_unit,
mass_unit, ..., plane_angle_unit, solid_angle_unit, ratio_unit)`, so a usable unit is always a
complex instance of a kind (`length_unit`) and a definition (`si_unit` or `conversion_based_unit`).

**`dimensional_exponents`** (P41; `DMNEXP`). Record of seven REALs: length, mass, time, electric
current, thermodynamic temperature, amount of substance, luminous intensity. Length is
(1,0,0,0,0,0,0); plane and solid angle are all zero.

**`si_unit`** (P41; `SUNT`). Record `SI_UNIT(*dimensions, prefix: si_prefix?, name: si_unit_name)`; in the
complex form `NAMED_UNIT(*)` and `SI_UNIT(prefix, name)`. `dimensions` is derived by
`dimensions_for_si_unit(name)`. `si_prefix = (exa, peta, tera, giga, mega, kilo, hecto, deca, deci,
centi, milli, micro, nano, pico, femto, atto)` with the usual powers 10^18 to 10^-18;
`si_unit_name = (metre, gram, second, ampere, kelvin, mole, candela, radian, steradian, hertz,
newton, pascal, joule, watt, coulomb, volt, farad, ohm, siemens, weber, tesla, henry,
degree_Celsius, lumen, lux, becquerel, gray, sievert)` [P41 measure_schema]. The CAx-IF's recommended form for SI base units
is `#4=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT($,.METRE.));` [UDA C.1]; files follow the same pattern:
`(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))`,
`(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))`,
`(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())` [Survey].

**`conversion_based_unit`** (P41; `CNBSUN`). Record
`CONVERSION_BASED_UNIT(dimensions, name: label, conversion_factor: measure_with_unit)`; the
dimensions slot is `*` under AP214 (derived there), a reference under AP203 edition 2 and AP242
(where WR1 checks it equals the dimensions of the factor's unit). Typical:
`#5=( CONVERSION_BASED_UNIT('INCH',#6) LENGTH_UNIT() NAMED_UNIT(#7) );`
`#6=LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),#mm);`
`#8=( CONVERSION_BASED_UNIT('DEGREE',#9) NAMED_UNIT(#7a) PLANE_ANGLE_UNIT() );`
`#9=PLANE_ANGLE_MEASURE_WITH_UNIT(PLANE_ANGLE_MEASURE(0.01745329252),#rad);`.
The name is a label, not a key: the survey found `'METRE'` with factor 1 m (Spatial),
`'MILLIMETRE'` with factor 1 mm (Spatial), `'INCH'` as 2.54 cm (CADDS), `'THOU'` as 0.0254 mm,
`'DEGREES'` (ACIS), and degree factors written with 10 to 15 significant digits [Survey]. Compute
the factor from `conversion_factor`, recursively through its unit.

**`length_unit`** (`LNGUNT`), **`plane_angle_unit`** (`PLANUN`), **`solid_angle_unit`** (`SLANUN`)
(P41). No attributes; WR1 fixes the dimensional exponents (length 1, all else 0; angles all 0).

Decoding to the vocabulary: the length unit becomes `LengthUnit` (`Metre`, `Millimetre`,
`Centimetre`, `Inch`, `Foot` when the factor in metres matches 1, 1e-3, 1e-2, 0.0254, 0.3048 to a
relative 1e-9, else `Scaled(MetresPerUnit)`); the uncertainty becomes `Tolerances.Length`
(converted to the model unit); the plane-angle factor is applied during decoding and not stored
(fact 1). A file carries no angle or parameter tolerance (P43 allows an uncertainty for any measure,
but the survey found only length uncertainties), so `Tolerances.Angle` and `Tolerances.Parameter`
are the library's own (unconfirmed that no exporter writes a plane-angle uncertainty).

### 3.2 Points, directions, placements, transformations

**`cartesian_point`** (P42 4.5.4; `CRTPNT`). Chain → point → geometric_representation_item →
representation_item. Record `CARTESIAN_POINT(name, coordinates: LIST[1:3] OF length_measure)`. In
model space, 3 coordinates in model length units; inside a 2D parameter-space context, (u,v) in the
surface's parameter units (section 5.1). In the 2021 schema it has subtypes `cylindrical_point`,
`spherical_point`, `polar_point` that redeclare `coordinates` as derived [P42 4.5.5 to 4.5.7]; they
would be written `CYLINDRICAL_POINT('',*,r,theta,z)` and none appeared in the survey.

**`direction`** (P42 4.5.14; `DRCTN`). Record `DIRECTION(name, direction_ratios: LIST[2:3] OF REAL)`.
WR1: `SIZEOF(QUERY(tmp <* direction_ratios | tmp <> 0.0)) > 0`, at least one ratio is non-zero.
Ratios are not normalized; only their proportions matter [P42 4.5.14 NOTE 1]. Normalize on decode
(`Direction3D`). A direction whose norm is so small that normalizing it is unstable is a decode error even though
WR1 passes. 101 of the 103 surveyed files write unit vectors; a Theorem file (24 directions) and a
Unigraphics file (1) do not [Survey].

**`vector`** (P42 4.5.15; `VECTOR`). Record `VECTOR(name, orientation: direction, magnitude: length_measure)`.
WR1: `magnitude >= 0.0`. The magnitude is given explicitly and must not be computed from the
direction ratios [P42 4.5.15 NOTE]. Value V = magnitude · <orientation>.

**`placement`** (P42 4.5.16; `PLCMNT`). Record `PLACEMENT(name, location: cartesian_point)`; only
instantiated as a subtype.

**`axis1_placement`** (P42 4.5.17; `AX1PLC`). Record `AXIS1_PLACEMENT(name, location, axis: direction?)`.
Derived z = <axis>, default (0,0,1). WR1: dimension 3. Decodes to `InfiniteLine3D`.

**`axis2_placement_2d`** (P42 4.5.18; `A2PL2D`). Record `AXIS2_PLACEMENT_2D(name, location, ref_direction: direction?)`.
Derived p = build_2axes(ref_direction): p[1] = <ref_direction> (default (1,0)), p[2] = its
counter-clockwise perpendicular, `orthogonal_complement(p[1])` = (−p1.y, p1.x) [P42 4.6.7, 4.6.31].
WR1: dimension 2. Used by conics inside pcurve definitions.

**`axis2_placement_3d`** (P42 4.5.19; `A2PL3D`). Record
`AXIS2_PLACEMENT_3D(name, location, axis: direction?, ref_direction: direction?)`.
Derived p = build_axes(axis, ref_direction) [P42 4.6.8]:

- z = <axis>, or (0,0,1) when axis is absent.
- x = first_proj_axis(z, ref_direction) [P42 4.6.23]: with a = <ref_direction>, x = <a − (a·z) z>.
  When ref_direction is absent, a = (1,0,0), unless z is exactly (1,0,0) or (−1,0,0), then
  a = (0,1,0). (Exact comparison in the EXPRESS function.)
- y = <z × x>.

The NOTE of 4.5.19 states this projection method as the preferred, numerically stable one.
WHERE: WR1 location has dimension 3; WR2, WR3 axis and ref_direction have dimension 3 if present;
WR4 `cross_product(axis, ref_direction).magnitude > 0.0`: they are not parallel or anti-parallel.
The rule does not require them to be orthogonal; the projection makes x orthogonal. When WR4 fails,
first_proj_axis returns an indeterminate value and the frame is undefined [P42 4.6.23]; OpenCascade
then falls back to its own default x, as if ref_direction were absent [OCC StepToGeom.cxx
MakeAxis2Placement, `IsParallel(..., Precision::Angular())`].

OpenCascade's default x when ref_direction is absent is **not** ISO's: it uses `gp_Ax2(P, N)`, which
picks x from the smallest component of N; for z = (0,0,−1) it gives x = (−1,0,0) where ISO gives
(1,0,0), and for z = (0,1,0) it gives (0,0,1) where ISO gives (1,0,0) [OCC gp_Ax2.cxx]. OpenCascade
knows the result is unreliable: it ignores the parameter trims of a conic whose placement lacks
ref_direction and makes a full circle instead [OCC StepToGeom.cxx MakeTrimmedCurve, comment
"OCC133"]. Of 188,372 surveyed placements, none omits `axis`, 9 omit `ref_direction` (an ACIS sample and a
Theorem sample), and none has axis and ref_direction more than 1e-9 away from orthogonal (|cos| ≤
1e-9) [Survey]. Implement ISO's rule; report a non-orthogonal pair as a warning with the angle, since
the projection repairs it. Decodes to `Frame3D`.

**`cartesian_transformation_operator_3d`** (P42 4.5.20, 4.5.21; `CTO3`). Chain →
cartesian_transformation_operator → (geometric_representation_item, functionally_defined_transformation).
Record `CARTESIAN_TRANSFORMATION_OPERATOR_3D(name, name, description?, axis1?, axis2?, local_origin, scale?, axis3?)`:
the first `name` from representation_item, the second and `description` from
functionally_defined_transformation (8 parameters; OpenCascade checks for 8 [OCC
RWStepGeom_RWCartesianTransformationOperator3d.cxx]). Derived scl = scale or 1.0 (WR1: scl > 0);
u = base_axis(3, axis1, axis2, axis3) [P42 4.6.6]: u[3] = <axis3> or (0,0,1); u[1] =
first_proj_axis(u[3], axis1); u[2] = second_proj_axis(u[3], u[1], axis2), which projects axis2 (or
(0,1,0) when absent) off u[3] and u[1], so the result may be left-handed. Matrix T has columns u[1],
u[2], u[3]; |T| = −1 means a mirror. Point map P → A + S·T·P with A = local_origin, S = scl;
direction d → T d; vector magnitude k → S k; length attributes (radii) scale by S [P42 4.5.20]. For
a face, |T| = −1 puts the interior on the right of the bounding loops (section 4.2). The
transformation applies after the derivation of placement frames.

### 3.3 Curves

The direction of a curve is the direction of increasing parameter [P42 4.2.4]. A curve is arcwise
connected and has positive arc length (IP1, IP2); a curve whose parameterization is not stated is
assumed to be arc-length parameterized (IP3) [P42 4.5.23]. Angular parameters (the u of circle and
ellipse, all angles of placement-based surfaces) use the context's plane-angle unit [P42 4.2.3].
Below, C, x, y, z are the location and the derived axes p[1], p[2], p[3] of the curve's
`axis2_placement` (section 3.2).

**`curve`** (P42 4.5.23; `CURVE`). Record `CURVE(name)`, never used alone. Supertype of
`ONEOF(line, conic, clothoid, circular_involute, pcurve, surface_curve, offset_curve_2d,
offset_curve_3d, curve_replica)`, with `bounded_curve` outside the ONEOF.

**`bounded_curve`** (P42 4.5.32; `BNDCRV`). Record `BOUNDED_CURVE(name)`; finite arc length, a start
and an end point (IP1, IP2). It appears as an empty record `BOUNDED_CURVE()` in complex rational
B-spline instances.

**`line`** (P42 4.5.24; `LINE`) → `BrepCurve.Line`. Record `LINE(name, pnt: cartesian_point, dir: vector)`.
WR1: `dir.dim = pnt.dim`. λ(u) = P + u·V with P = pnt and V = dir (the vector, magnitude
included); u ∈ (−∞, ∞), not periodic. The magnitude sets the speed: |λ'(u)| = |V|, so u is a length
only when |V| = 1. Exporters differ [Survey]: Creo and Pro/ENGINEER put P at the edge's start vertex
and |V| equal to the edge length, so u runs from 0 to 1 along the edge; SolidWorks writes |V| = 1000
(u in metres in a millimetre file), mostly with P at the start vertex; Spatial and Unigraphics write
|V| = 1 with P anywhere on the line. Keep V as given; never assume unit speed.

**`conic`** (P42 4.5.25; `CONIC`). Record `CONIC(name, position: axis2_placement)`, where
`axis2_placement = SELECT(axis2_placement_2d, axis2_placement_3d)` [P42 4.4.1]: 2D placements for
conics inside pcurves, 3D for model space. Supertype of `ONEOF(circle, ellipse, hyperbola,
parabola)`.

**`circle`** (P42 4.5.26; `CIRCLE`) → `BrepCurve.Circle`. Record `CIRCLE(name, position, radius: positive_length_measure)`.
λ(u) = C + R(cos u·x + sin u·y). Domain one full turn, u ∈ [0, 2π) in radians (stated as
"0 ≤ u ≤ 360 degrees"); periodic with period 2π (one turn in the context's angle unit). Tangent at u
is −sin u·x + cos u·y: counter-clockwise about z. R > 0 by the type. No degeneracy.

**`ellipse`** (P42 4.5.27; `ELLPS`) → `BrepCurve.Ellipse`. Record
`ELLIPSE(name, position, semi_axis_1: positive_length_measure, semi_axis_2: positive_length_measure)`.
λ(u) = C + R1 cos u·x + R2 sin u·y with R1 = semi_axis_1, R2 = semi_axis_2; period 2π. The
2021 text as read prints R1 in both terms, which contradicts its own implicit equation
(x/R1)² + (y/R2)² = 1; R2 on the sine term is the consistent reading (typographical error in the
copy read). R1 < R2 is legal: semi_axis_1 is along x whichever is longer. OpenCascade requires
major ≥ minor, so for R1 < R2 it rotates the frame by 90° and shifts trim parameters by π/2
[OCC StepToGeom.cxx MakeEllipse, MakeTrimmedCurve]. Our kernel must not impose major ≥ minor.

**`hyperbola`** (P42 4.5.28; `HYPRBL`) → `BrepCurve.Hyperbola`. Record
`HYPERBOLA(name, position, semi_axis: positive_length_measure, semi_imag_axis: positive_length_measure)`.
λ(u) = C + R1 cosh u·x + R2 sinh u·y; u ∈ (−∞, ∞); the branch on the +x side. u is not an angle
(no unit conversion).

**`parabola`** (P42 4.5.29; `PRBL`) → `BrepCurve.Parabola`. Record `PARABOLA(name, position, focal_dist: length_measure)`.
WR1: `focal_dist <> 0.0`. λ(u) = C + F(u²·x + 2u·y), F = focal_dist; u ∈ (−∞, ∞); apex at C;
implicit equation 4Fx − y² = 0. A negative F opens toward −x.

**`polyline`** (P42 4.5.33; `PLYLN`) → `BrepCurve.Polyline`. Record `POLYLINE(name, points: LIST[2:?] OF cartesian_point)`.
With points P_1 ... P_n, segment i (1 ≤ i ≤ n−1) is λ(u) = P_i(i − u) + P_{i+1}(u + 1 − i) for
i−1 ≤ u ≤ i. Domain [0, n−1]; not periodic even if P_n = P_1. A repeated consecutive point gives a
zero-length segment, which violates `curve` IP2 only if every segment is degenerate.

**`b_spline_curve`** (P42 4.5.34; `BSPCR`) → `BrepCurve.BSpline`. Record
`B_SPLINE_CURVE(name, degree: INTEGER, control_points_list: LIST[2:?] OF cartesian_point, curve_form: b_spline_curve_form, closed_curve: LOGICAL, self_intersect: LOGICAL)`.
Supertype of `ONEOF(uniform_curve, b_spline_curve_with_knots, quasi_uniform_curve, bezier_curve)
ANDOR rational_b_spline_curve`. WR1: one of the four knot subtypes is present. With k+1 control
points P_0..P_k (k = upper_index_on_control_points), degree d and the expanded knot array
u_{−d} ≤ ... ≤ u_{k+1} (k+d+2 values):
polynomial C(u) = Σ_{i=0..k} N_i^d(u)·P_i; rational C(u) = Σ w_i N_i^d(u) P_i / Σ w_i N_i^d(u),
N_i^d the normalized B-spline basis on [u_{i−d}, u_{i+1}] (the formulas are images in the copy read;
this is the standard form they denote, consistent with the index ranges in the text). Domain and
knot expansion: section 5.3. `curve_form`, `closed_curve` and `self_intersect` are "for information
only": where they disagree with the data, the data wins [P42 4.5.34 NOTE 10].
`b_spline_curve_form = (polyline_form, circular_arc, elliptic_arc, parabolic_arc, hyperbolic_arc,
unspecified)` [P42 4.4.2].

**`b_spline_curve_with_knots`** (P42 4.5.35; `BSCWK`). Record
`B_SPLINE_CURVE_WITH_KNOTS(name, degree, control_points_list, curve_form, closed_curve, self_intersect, knot_multiplicities: LIST[2:?] OF INTEGER, knots: LIST[2:?] OF parameter_value, knot_spec: knot_type)`.
WR1: `constraints_param_b_spline(degree, upper_index_on_knots, upper_index_on_control_points,
knot_multiplicities, knots)`; WR2: the two lists have equal length. The function requires: degree ≥ 1;
at least 2 distinct knots; k ≥ d; Σ multiplicities = d + k + 2; first multiplicity in [1, d+1];
knots strictly increasing; interior multiplicities in [1, d]; last multiplicity in [1, d+1]
[P42 4.6.11]. `knot_type = (uniform_knots, quasi_uniform_knots, piecewise_bezier_knots,
unspecified)`, information only [P42 4.4.7]. The survey found no violation in 43,115 B-spline curves
[Survey].

**`uniform_curve`** (P42 4.5.36; `UNFCRV`), **`quasi_uniform_curve`** (P42 4.5.37; `QSUNCR`),
**`bezier_curve`** (P42 4.5.38; `BZRCRV`). Same record as `b_spline_curve` under their own names; the
knots are implied (section 5.3). OpenCascade treats every `bezier_curve` as a single segment with
knots (0,1) and multiplicities (d+1, d+1) [OCC StepToGeom.cxx MakeBSplineCurve for Bézier], which is
wrong for a piecewise Bézier curve with more than d+1 control points; it also starts uniform knots at
0 where ISO starts them at −d [OCC same file; P42 4.6.19]. The two give the same point set but
different parameter values.

**`rational_b_spline_curve`** (P42 4.5.39; `RBSC`). Record (simple form, rarely used)
`RATIONAL_B_SPLINE_CURVE(name, degree, control_points_list, curve_form, closed_curve, self_intersect, weights_data: LIST[2:?] OF REAL)`.
WR1: as many weights as control points; WR2: all weights > 0 (`curve_weights_positive`). It is
always combined with a knot subtype, so it appears as the complex instance of section 1.3:
`( BOUNDED_CURVE() B_SPLINE_CURVE(d,(...),form,closed,self) B_SPLINE_CURVE_WITH_KNOTS((mults),(knots),spec)
CURVE() GEOMETRIC_REPRESENTATION_ITEM() RATIONAL_B_SPLINE_CURVE((weights)) REPRESENTATION_ITEM('') )`.
A B-spline is rational only if the weights differ; equal weights are a polynomial curve [P42
4.5.34 NOTE 2]. The vocabulary's `BSplineCurveData` stores weights always (all ones when polynomial).

**`trimmed_curve`** (P42 4.5.43; `TRMCRV`) → `BrepCurve.Trimmed`. Record
`TRIMMED_CURVE(name, basis_curve: curve, trim_1: SET[1:2] OF trimming_select, trim_2: SET[1:2] OF trimming_select, sense_agreement: BOOLEAN, master_representation: trimming_preference)`.
`trimming_select = SELECT(cartesian_point, parameter_value)`, so each trim is a point, a
`PARAMETER_VALUE(t)`, or both [P42 4.4.16]; `trimming_preference = (cartesian, parameter,
unspecified)` [P42 4.4.15]. WR1, WR2: when a trim has two values, they are of different types (one
point, one parameter). Informal: point and parameter agree (IP1); points lie on the basis curve
(IP2); for an open basis curve, `sense_agreement = (t1 < t2)` (IP3); t1 ≠ t2 (IP4); parameters lie in
the basis curve's range (IP5). Parameterization: s = t − t1 if sense_agreement, s = t1 − t
otherwise, s from 0 to |t2 − t1| [P42 4.5.43]. On a closed basis curve, add one period to t2 (sense
TRUE, t2 < t1) or to t1 (sense FALSE, t1 > t2); 370° is the same point as 10° [P42 4.5.43 NOTE 1,
2]. Trim parameters on conics are angles in the context unit; on a line they are values of u, which
OpenCascade multiplies by |V| because its lines are unit speed [OCC StepToGeom.cxx
MakeTrimmedCurve]. When `master_representation` is `.UNSPECIFIED.`, OpenCascade prefers a parameter if
one is given, else projects the point [OCC ExtractParameter]. The kernel can keep the basis
parameter t and store [t1, t2] and the sense; s is an affine function of t. Not allowed as edge
geometry of an `advanced_face` (section 3.5); Creo writes 35,533 of them, none as edge geometry
(they define presentation wireframes) [Survey].

**`composite_curve`** (P42 4.5.44; `CMPCRV`) → `BrepCurve.Composite`. Record
`COMPOSITE_CURVE(name, segments: LIST[1:?] OF composite_curve_segment, self_intersect: LOGICAL)`.
Derived `closed_curve := segments[n].transition <> discontinuous`. WR1: an open curve has exactly
one `discontinuous` transition (the last); a closed curve has none. Parameterization: segment i
spans [Σ_{k<i} l_k, Σ_{k≤i} l_k], l_k the parametric length (max − min parameter) of segment k's
curve; T = Σ_{k<i} l_k + (t − t_i0) when the segment's same_sense is TRUE, T = Σ_{k<i} l_k +
(t_i1 − t) when FALSE (the per-segment formulas are images in the copy read; this is the form
consistent with the stated ranges and with 4.5.46) (unconfirmed exact form). Not allowed as edge
geometry of an `advanced_face`.

**`composite_curve_segment`** (P42 4.5.45; `CMCRSG`). Not a representation item (subtype of the
abstract `founded_item`), so its record has no name: `COMPOSITE_CURVE_SEGMENT(transition: transition_code, same_sense: BOOLEAN, parent_curve: curve)`.
WR1: `parent_curve` is a `bounded_curve`. If same_sense is FALSE the segment starts at its curve's
highest parameter. `transition_code = (discontinuous, continuous, cont_same_gradient,
cont_same_gradient_same_curvature)`, geometric continuity at the segment's end [P42 4.4.14].
Subtype `reparametrised_composite_curve_segment` adds `param_length` (WR1 > 0) and rescales the
segment to [0, param_length] [P42 4.5.46].

**`offset_curve_3d`** (P42 4.5.55; `OFCR3D`) → `BrepCurve.Offset`. Record
`OFFSET_CURVE_3D(name, basis_curve: curve, distance: length_measure, self_intersect: LOGICAL, ref_direction: direction)`.
WR1: basis curve and ref_direction are 3D. λ(u) = C(u) + d·<v × t(u)>, t the unit tangent of the
basis curve C, v = ref_direction, d = distance; parameterization inherited from the basis curve
[P42 4.5.55]. IP1: v is never parallel to t. The basis must have a continuous tangent (composite
segments `cont_same_gradient` or better). OpenCascade's offset direction is t × v, so it negates d
[OCC StepToGeom.cxx MakeCurve]. Not allowed as edge geometry of an `advanced_face`; allowed in
manifold surface models (section 3.8).

### 3.4 Curves on surfaces

**`pcurve`** (P42 4.5.47; `PCURVE`). Record
`PCURVE(name, basis_surface: surface, reference_to_curve: definitional_representation)`.
WR1: the definitional representation has exactly one item; WR2: it is a `curve`; WR3: of dimension 2.
The 3D curve is λ(t) = σ(f(t)), with (u,v) = f(t) the 2D curve and σ the surface; the parameter is
t, the 2D curve's [P42 4.5.47]. The 2D curve's coordinates are in the surface's natural parameters
(angles in the context unit, lengths in model units; section 5.1). 2D curve kinds found: LINE
(most common), B-spline, rational B-spline, CIRCLE [Survey]. Decodes to a `Pcurve { Surface; Curve:
Curve2DIndex }` plus a `BrepCurve2D`.

**`definitional_representation`** (P43 4.4.4; `DFNRPR`). Record
`DEFINITIONAL_REPRESENTATION(name, items: SET[1:?] OF representation_item, context_of_items: representation_context)`.
WR1: the context is a `parametric_representation_context`. Typical:
`#40=DEFINITIONAL_REPRESENTATION('',(#41),#42);` with `#42=( GEOMETRIC_REPRESENTATION_CONTEXT(2)
PARAMETRIC_REPRESENTATION_CONTEXT() REPRESENTATION_CONTEXT('2D SPACE','') );` [Survey].

**`surface_curve`** (P42 4.5.49; `SRFCRV`) → `BrepCurve.OnSurface`. Record
`SURFACE_CURVE(name, curve_3d: curve, associated_geometry: LIST[1:2] OF pcurve_or_surface, master_representation: preferred_surface_curve_representation)`.
`pcurve_or_surface = SELECT(pcurve, surface)`: an entry is either a pcurve (naming a surface and a 2D
curve) or just the surface [P42 4.4.10]. `preferred_surface_curve_representation = (curve_3d,
pcurve_s1, pcurve_s2)` [P42 4.4.11]. Derived `basis_surface : SET[1:2] OF surface`. WR1: curve_3d is
3D; WR2, WR3: `pcurve_s1` (`pcurve_s2`) may be named only if entry 1 (2) is a pcurve; WR4: curve_3d
is not a pcurve. Informal: the 3D curve and the pcurves are the same point set (IP1) and have the
same sense (IP2), but they may be parameterized differently. All characteristics (parameterization,
domain, evaluation) come from the master representation; the others are "a compromise for practical
considerations" [P42 4.2.6, 4.5.49]. Masters seen: `.PCURVE_S1.` (OpenCascade 6.2 and 7.3, the versions in the
sample that wrote pcurves; 6.8 and 7.5 wrote none), `.PCURVE_S2.` (Euclid, CAS.CADE), `.CURVE_3D.`
(ACIS) [Survey]. The `edge_curve` takes its parameterization from the
master; since edge ranges come from vertex projection anyway (section 4.1), the practical effect is
that the 3D curve is the shape of the edge and the pcurves locate it in each face's (u,v) space.

**`seam_curve`** (P42 4.5.51; `SMCRV`). Same record as `surface_curve`. WR1: two associated
geometries; WR2: both on the same surface; WR3, WR4: both are pcurves. A curve on a closed surface
with two representations as constant-parameter lines at the two ends of the parameter range, such as
u = 0 and u = 2π on a cylinder. Which pcurve belongs to which use of the edge is not recorded
(section 6.2). Of the files whose faces contain an edge used twice (a seam), only Euclid
(12 seams) and one FreeCAD file through OpenCascade 7.3 (1 seam) use `seam_curve`; OpenCascade 6.8
and 7.5 and Autodesk write the seam edge with a plain line, circle or B-spline and no pcurves
[Survey]. A reader must therefore recognise a seam by topology (one edge used twice in one face) and
geometry, not by entity type; OpenCascade does the same for a `surface_curve` whose two pcurves lie
on one surface ("like a seam", [OCC StepToTopoDS_TranslateEdgeLoop.cxx IsLikeSeam]).

**`seam_edge`** (P42 5.5.7; not in the short-name table). An `oriented_edge` subtype that names which
pcurve of a seam curve its use takes: record `SEAM_EDGE(name, *, *, edge_element, orientation, pcurve_reference: pcurve)`.
WR1: edge_element is an `edge_curve` on a `seam_curve`; WR2: pcurve_reference is one of its two
pcurves. Present in AP214, AP238, AP242 [AIM t_seam_edge]; none in the survey.

**`intersection_curve`** (P42 4.5.50; `INTCRV`). Same record. WR1: two associated geometries; WR2:
on distinct surfaces. ACIS writes every edge as an intersection_curve whose two associated geometries
are the two planes, not pcurves, with master `.CURVE_3D.` [Survey, `block.stp`].

**`bounded_pcurve`** (P42 4.5.48; `BNDPCR`), **`bounded_surface_curve`** (P42 4.5.52; `BNSRCR`):
the same records as `pcurve` and `surface_curve`, combined with `bounded_curve`; WR1 requires the
underlying curve to be bounded. Appear inside `composite_curve_on_surface` and boundary curves of
`curve_bounded_surface`.

**`degenerate_pcurve`** (P42 4.5.12; `DGNPCR`). A subtype of `point`, not of curve: a curve in a
surface's parameter space whose image in model space is a single point, such as the apex of a cone.
Record `DEGENERATE_PCURVE(name, basis_surface: surface, reference_to_curve: definitional_representation)`,
with the same WR1 to WR3 as `pcurve`; IP1: zero arc length in model space.
**`evaluated_degenerate_pcurve`** (P42 4.5.13; `EVDGPC`) adds `equivalent_point: cartesian_point`.
Allowed as vertex geometry in `manifold_surface_shape_representation` (WR12, WR14 there) [AIM], not
in `advanced_face` (which requires `cartesian_point` vertex geometry, WR4, WR7). None in the survey.
OpenCascade has no reader for it in StepToGeom (no `MakeDegeneratePcurve`; unconfirmed whether
another component handles it).

### 3.5 Surfaces

Every surface has a parametric form σ(u,v) and a unit normal N(u,v) = <σ_u × σ_v> [P42 4.5.57; the
copy read prints σ_u × σ_u, a typographical error]. One exception in this catalogue: the inner
("lemon") part of a `degenerate_toroidal_surface` has its stated normal opposite to σ_u × σ_v
[P42 4.5.64 NOTE 1]. A surface has non-zero area and is arcwise connected (IP1, IP2) and may
self-intersect [P42 4.5.57; 5.2.1]. The elementary surfaces are unbounded in their non-angular
directions; a face bounds them [P42 4.2.5]. C, x, y, z denote `position.location` and `position.p[1..3]`.

**`surface`** (P42 4.5.57; `SRFC`). Record `SURFACE(name)`. Supertype of `ONEOF(elementary_surface,
swept_surface, bounded_surface, offset_surface, surface_replica)`.

**`elementary_surface`** (P42 4.5.58; `ELMSRF`). Record `ELEMENTARY_SURFACE(name, position: axis2_placement_3d)`.
Supertype of `ONEOF(plane, cylindrical_surface, conical_surface, spherical_surface,
toroidal_surface)`.

**`plane`** (P42 4.5.59; `PLANE`) → `BrepSurface.Plane`. Record `PLANE(name, position)`.
σ(u,v) = C + u·x + v·y; u, v ∈ (−∞, ∞), lengths in model units; N = z. No degeneracy.

**`cylindrical_surface`** (P42 4.5.60; `CYLSRF`) → `BrepSurface.Cylinder`. Record
`CYLINDRICAL_SURFACE(name, position, radius: positive_length_measure)`.
σ(u,v) = C + R(cos u·x + sin u·y) + v·z; u ∈ [0, 2π) periodic (angle unit), v ∈ (−∞, ∞) (length,
the unit of the radius). N = cos u·x + sin u·y, pointing away from the axis. No degeneracy.

**`conical_surface`** (P42 4.5.61; `CNCSRF`) → `BrepSurface.Cone`. Record
`CONICAL_SURFACE(name, position, radius: length_measure, semi_angle: plane_angle_measure)`.
WR1: `radius >= 0.0`. σ(u,v) = C + (R + v·tan α)(cos u·x + sin u·y) + v·z with R = radius,
α = semi_angle; u ∈ [0, 2π) periodic, v ∈ (−∞, ∞) **measured along the axis**. R is the radius in the
plane through C normal to the axis; R = 0 puts the apex at C. The apex is at v = −R / tan α, where
σ_u = 0: a degenerate boundary (the u-isoline collapses to a point). For R + v tan α > 0,
N = (cos u·x + sin u·y − tan α·z) / √(1 + tan²α), away from the axis; for R + v tan α < 0 (the other
nappe) N is the negation of that expression, still equal to <σ_u × σ_v> [P42 4.5.61]. The copy read
labels α "= radius" in its data list, a typographical error. semi_angle is in the context's angle
unit: Unigraphics writes `45.` and Creo `7.650426671920E1` in degree files [Survey]. The standard
states no range for α (unconfirmed); α = 0 makes a cylinder and |α| ≥ π/2 is meaningless, and
OpenCascade clamps α below at its angular precision [OCC StepToGeom.cxx MakeConicalSurface].
OpenCascade's cone measures v along the slant (its σ has v·cos α along the axis), so it multiplies
pcurve and trim v values by 1/cos α on import [OCC GeomConvert_Units.cxx DegreeToRadian;
StepToGeom.cxx MakeRectangularTrimmedSurface]. Our `Cone` must use ISO's v.

**`spherical_surface`** (P42 4.5.62; `SPHSRF`) → `BrepSurface.Sphere`. Record
`SPHERICAL_SURFACE(name, position, radius: positive_length_measure)`.
σ(u,v) = C + R cos v (cos u·x + sin u·y) + R sin v·z; u ∈ [0, 2π) periodic, v ∈ [−π/2, π/2] (latitude;
both angles in the angle unit). N = cos v (cos u·x + sin u·y) + sin v·z, outward. Degenerate
boundaries: v = π/2 and v = −π/2, the poles C ± R z, where σ_u = 0.

**`toroidal_surface`** (P42 4.5.63; `TRDSRF`) → `BrepSurface.Torus`. Record
`TOROIDAL_SURFACE(name, position, major_radius: positive_length_measure, minor_radius: positive_length_measure)`.
σ(u,v) = C + (R + r cos v)(cos u·x + sin u·y) + r sin v·z with R = major, r = minor; u, v ∈ [0, 2π)
both periodic. N = cos v (cos u·x + sin u·y) + sin v·z, away from the nearest point of the circle of
radius R about C. Manifold only when R > r; otherwise self-intersecting [P42 4.5.63]. R = r collapses
the circle v = π to the point C (σ_u = 0 there). Deviations: a Unigraphics sample writes a
`toroidal_surface` with major 8.25 < minor 54.87 instead of a `degenerate_toroidal_surface` [Survey,
`moon_buggy_asm.stp`]; SolidWorks has written negative major radii, which SolidWorks and Pro/ENGINEER
interpret as a reversed face; OpenCascade reads them as |R| with the face's same_sense inverted [OCC StepToTopoDS_TranslateFace.cxx
`isReversed`, comment citing bug 0026376; StepToGeom.cxx MakeToroidalSurface uses `std::abs`] (no
such file in the survey).

**`degenerate_toroidal_surface`** (P42 4.5.64; `DGTRSR`) → `BrepSurface.Torus` with a restricted v
range. Record `DEGENERATE_TOROIDAL_SURFACE(name, position, major_radius, minor_radius, select_outer: BOOLEAN)`.
WR1: `major_radius < minor_radius`. Same σ as the torus. With φ defined by r cos φ = −R:
select_outer TRUE ("apple") takes v ∈ [−φ, φ]; FALSE ("lemon") takes v ∈ [φ, 2π − φ]; u ∈ [0, 2π)
periodic in both. v is not periodic within the selected range. The ends v = ±φ (apple) or v = φ,
2π − φ (lemon) are the two points where the surface meets the axis: degenerate boundaries. For the
lemon the stated normal is −<σ_u × σ_v> [P42 4.5.64 NOTE 1]. The vocabulary's `Torus` case needs
either a flag or a separate payload field to carry select_outer; a plain `toroidal_surface` with
R < r (the deviation above) should decode to the same thing with a diagnostic.

**`swept_surface`** (P42 4.5.66; `SWPSRF`). Record `SWEPT_SURFACE(name, swept_curve: curve)`. If the
swept curve is a pcurve, its 3D image is swept.

**`surface_of_linear_extrusion`** (P42 4.5.67; `SL`) → `BrepSurface.LinearExtrusion`. Record
`SURFACE_OF_LINEAR_EXTRUSION(name, swept_curve, extrusion_axis: vector)`.
σ(u,v) = λ(u) + v·V with V = extrusion_axis (magnitude included; it sets the v scale); u from the
curve's parameterization, v ∈ (−∞, ∞). IP1: no self-intersection. N = <λ'(u) × V>. Degenerate where
λ'(u) is parallel to V (excluded in practice). OpenCascade builds it from the unit direction and
drops the magnitude, and does not rescale pcurve v values on such surfaces [OCC StepToGeom.cxx
MakeSurfaceOfLinearExtrusion; GeomConvert_Units.cxx has no branch for it] (consequence for files with
|V| ≠ 1 unconfirmed by test). In an `advanced_face`, the swept curve must be a line, conic,
polyline (≥ 3 points) or B-spline (AIC WR6, WR10).

**`surface_of_revolution`** (P42 4.5.68; `SROFRV`) → `BrepSurface.Revolution`. Record
`SURFACE_OF_REVOLUTION(name, swept_curve, axis_position: axis1_placement)`.
With λ(v) the swept curve, C = axis_position.location, V = axis_position.z:
σ(u,v) = C + (λ(v) − C) cos u + ((λ(v) − C)·V) V (1 − cos u) + V × (λ(v) − C) sin u,
the rotation of λ(v) by angle u about the axis (right-handed about V). u ∈ [0, 2π) periodic (angle
unit); v ranges over the curve's parameter range [P42 4.5.68]. The curve must not meet any (r,z)
twice (single-valued), IP1 no self-intersection, IP2 the curve does not run along the axis for a
finite length. Degenerate boundary: any end of the v range where λ(v) lies on the axis (σ_u = 0
there), for example a hemisphere made by revolving a quarter circle. Derived `axis_line` is the axis
as a `line`.

**`bounded_surface`** (P42 4.5.71; `BNDSRF`). Record `BOUNDED_SURFACE(name)`; appears empty in
complex rational B-spline surfaces.

**`b_spline_surface`** (P42 4.5.72; `BSPSR`) → `BrepSurface.BSpline`. Record
`B_SPLINE_SURFACE(name, u_degree: INTEGER, v_degree: INTEGER, control_points_list: LIST[2:?] OF LIST[2:?] OF cartesian_point, surface_form: b_spline_surface_form, u_closed: LOGICAL, v_closed: LOGICAL, self_intersect: LOGICAL)`.
Supertype of `ONEOF(b_spline_surface_with_knots, uniform_surface, quasi_uniform_surface,
bezier_surface) ANDOR rational_b_spline_surface`; WR1: one of the four knot subtypes is present.
Control points are listed P_00, P_01, ..., P_0K2, P_10, ...: the outer list runs over u (index i,
0..K1), the inner over v (index j, 0..K2) [P42 4.5.72; P21 12.1.3]. Polynomial
σ(u,v) = Σ_i Σ_j N_i^{d1}(u) N_j^{d2}(v) P_ij; rational form divides Σ w_ij N_i N_j P_ij by
Σ w_ij N_i N_j (image formulas in the copy read; standard form). Knots per direction as for curves
(section 5.3). `u_closed`, `v_closed`, `self_intersect`, `surface_form` are information only.
`b_spline_surface_form = (plane_surf, cylindrical_surf, conical_surf, spherical_surf, toroidal_surf,
surf_of_revolution, ruled_surf, generalised_cone, quadric_surf, surf_of_linear_extrusion,
unspecified)` [P42 4.4.3]; `generalised_cone` announces that all control points of one boundary row
coincide, a degenerate boundary [P42 4.4.3]. Degenerate sides in general: a side whose control
points all coincide (within tolerance) collapses to a point when that direction is clamped; detect
geometrically, never from the form. OpenCascade converts a B-spline face surface to its periodic
form when it is closed ("Surface forced to be periodic") [OCC StepToTopoDS_TranslateFace.cxx].

**`b_spline_surface_with_knots`** (P42 4.5.73; `BSSWK`). Record
`B_SPLINE_SURFACE_WITH_KNOTS(name, u_degree, v_degree, control_points_list, surface_form, u_closed, v_closed, self_intersect, u_multiplicities: LIST[2:?] OF INTEGER, v_multiplicities: LIST[2:?] OF INTEGER, u_knots: LIST[2:?] OF parameter_value, v_knots: LIST[2:?] OF parameter_value, knot_spec: knot_type)`.
WR1, WR2: `constraints_param_b_spline` in u and in v; WR3, WR4: multiplicity and knot lists of equal
length in each direction. Note the order: both multiplicity lists, then both knot lists.

**`uniform_surface`** (`UNFSRF`), **`quasi_uniform_surface`** (`QSUNSR`), **`bezier_surface`**
(`BZRSRF`) (P42 4.5.74 to 4.5.76). Records as `b_spline_surface`; knots implied per direction
(section 5.3). CADDS 5 writes `quasi_uniform_surface` faces [Survey].

**`rational_b_spline_surface`** (P42 4.5.77; `RBSS`). Adds `weights_data : LIST[2:?] OF LIST[2:?] OF REAL`,
same shape as the control points (WR1), all positive (WR2). Always in a complex instance with a knot
subtype, records `BOUNDED_SURFACE() B_SPLINE_SURFACE(...) B_SPLINE_SURFACE_WITH_KNOTS(...)
GEOMETRIC_REPRESENTATION_ITEM() RATIONAL_B_SPLINE_SURFACE(...) REPRESENTATION_ITEM('') SURFACE()`.

**`rectangular_trimmed_surface`** (P42 4.5.80; `RCTRSR`) → `BrepSurface.RectangularTrimmed`. Record
`RECTANGULAR_TRIMMED_SURFACE(name, basis_surface: surface, u1, u2, v1, v2: parameter_value, usense: BOOLEAN, vsense: BOOLEAN)`.
WR1: u1 ≠ u2; WR2: v1 ≠ v2; WR3: usense = (u2 > u1) unless the basis is a non-planar elementary
surface or a surface of revolution (closed in u); WR4: vsense = (v2 > v1) unless the basis is a
sphere or torus. IP1: the trimmed domain lies in the basis domain. New parameters run from 0 to
|u2 − u1| and 0 to |v2 − v1| by the `trimmed_curve` rule; cyclic ranges allow adding a period
[P42 4.5.80]. Trim values are in the basis surface's parameter units (angles in the angle unit).
Not allowed as the face geometry of an `advanced_face` (AIC WR1), so it reaches a mesher only through
surface models (whether `msf_surface_check` admits it was not read (unconfirmed)) or non-conforming
files; OpenCascade unwraps it to its basis when deciding face orientation [OCC StepToTopoDS_TranslateFace.cxx `isReversed`].

**`curve_bounded_surface`** (P42 4.5.81; `CRBNSR`). Record
`CURVE_BOUNDED_SURFACE(name, basis_surface, boundaries: SET[1:?] OF boundary_curve, implicit_outer: BOOLEAN)`.
The region lies to the side n × t of each boundary (n the surface normal, t the boundary tangent).
WR1 to WR4: no explicit outer boundary when implicit_outer; implicit_outer only on a bounded basis;
at most one `outer_boundary_curve`; every boundary lies on the basis surface. Boundaries are closed
(IP1), disjoint (IP2). A trimmed surface without topology; used in geometrically bounded surface
models, not in B-reps. No vocabulary case; out of scope for B-rep meshing except as a diagnostic.

**`offset_surface`** (P42 4.5.86; `OFFSRF`) → `BrepSurface.Offset`. Record
`OFFSET_SURFACE(name, basis_surface: surface, distance: length_measure, self_intersect: LOGICAL)`.
σ(u,v) = S(u,v) + d·N_S(u,v), N_S the basis unit normal (extended by continuity at singular points);
parameters as the basis [P42 4.5.86]. Not allowed in an `advanced_face` (AIC WR1); OpenCascade reads
it anyway with the warning "Type OffsetSurface is out of scope of AP 214", and first converts a C0
basis to C1 [OCC StepToTopoDS_TranslateFace.cxx, StepToGeom.cxx MakeSurface]. None in the survey.

**`oriented_surface`** (P42 4.5.87; `ORNSRF`). Adds `orientation : BOOLEAN` and flips N when FALSE;
instantiated together with another surface type. Forbidden as `face_surface.face_geometry`
(face_surface WR1).

**`surface_replica`** (P42 4.5.88; `SRFRPL`), **`curve_replica`** (P42 4.5.56; `CRVRPL`): a parent
plus a `cartesian_transformation_operator`; not allowed in advanced faces; OpenCascade reads both
[OCC StepToGeom.cxx]. None in the survey.

What an `advanced_face` allows [AIC aic_topologically_bounded_surface, `advanced_face` WR1 to WR10;
the rule text is identical, after normalizing whitespace and schema prefixes, in the AP242 edition 3, AP214 edition 3 and AP203 edition 2 long forms (checked by script)]:

| Rule | Requirement |
|---|---|
| WR1 | face_geometry is exactly one of `elementary_surface`, `b_spline_surface`, `swept_surface` |
| WR2 | every oriented edge of every edge loop has an `edge_curve` as edge_element |
| WR3 | every edge geometry is exactly one of `line`, `conic`, `polyline`, `surface_curve`, `b_spline_curve` |
| WR4 | both vertices of every edge are `vertex_point`s on `cartesian_point`s |
| WR5 | no edge loop is an `oriented_path` |
| WR6 | a swept surface's swept curve is a `line`, `conic`, `polyline` or `b_spline_curve` |
| WR7 | a vertex loop's vertex is a `vertex_point` on a `cartesian_point` |
| WR8 | every bound is an `edge_loop` or a `vertex_loop` (no `poly_loop`) |
| WR9 | a `surface_curve` edge's associated geometries are all pcurves (no bare surfaces) |
| WR10 | polylines (as edge geometry or swept curve) have at least 3 points |

Consequences: inside an advanced B-rep the surface sum is Plane, Cylinder, Cone, Sphere, Torus
(including degenerate), LinearExtrusion, Revolution, BSpline; the edge curve sum is Line, conics,
Polyline, BSpline, and OnSurface whose 3D curve is itself one of those (surface_curve WR4 forbids a
pcurve as curve_3d; whether the 3D curve of a surface_curve may be a trimmed or composite curve is
not restricted by these rules (unconfirmed)). The curve cases `Trimmed`, `Composite`, `Offset` and the surface
cases `RectangularTrimmed` and `Offset` are needed only for surface models, pcurve definitions, and
non-conforming files. ACIS's `intersection_curve` with bare planes violates WR9 [Survey, `block.stp`].

### 3.6 Topology

STEP topology is model-space topology: vertices, edges and faces are point sets in 3D, degenerate
(zero-length) edges are not allowed, and parameter-space information is carried by geometry
(pcurves), not by topology [P42 5.2.2]. All entities below are under
`topological_representation_item` → `representation_item` and carry `name` first. Informal
propositions (IP) are listed because they are the validity rules a checker can test; section 7
collects them.

**`topological_representation_item`** (P42 5.5.1; `TPRPIT`). Record `TOPOLOGICAL_REPRESENTATION_ITEM(name)`.
IP1: no two distinct non-oriented edges, edge_curves or face_surfaces reachable from one item have
intersecting domains. The only intended complex instances with `geometric_representation_item` are
`edge_curve`, `face_surface`, `vertex_point`; with `loop` and `path`, only `edge_loop` [P42 5.5.1
NOTE 1, 2].

**`vertex`** (P42 5.5.2; `VERTEX`). Record `VERTEX(name)`. Dimension 0, extent 0.

**`vertex_point`** (P42 5.5.3; `VRTPNT`) → `BrepVertex`. Chain → (vertex, geometric_representation_item).
Record `VERTEX_POINT(name, vertex_geometry: point)`. The domain is the point. In an advanced face it
must be a `cartesian_point` (AIC WR4, WR7).

**`edge`** (P42 5.5.4; `EDGE`). Record `EDGE(name, edge_start: vertex, edge_end: vertex)`. The domain
is a finite, non-self-intersecting open curve (a 1-manifold) not including its bounding vertices;
the vertices may be the same (a self-loop, graph genus 1) [P42 5.5.4]. Extent finite and non-zero
(IP2). The edge is oriented from edge_start to edge_end.

**`edge_curve`** (P42 5.5.5; `EDGCRV`) → `BrepEdge`. Chain → (edge, geometric_representation_item).
Record `EDGE_CURVE(name, edge_start: vertex, edge_end: vertex, edge_geometry: curve, same_sense: BOOLEAN)`.
The curve may be unbounded and is implicitly trimmed by the vertices; same_sense TRUE means the
curve's direction (increasing parameter) agrees with the edge's (start to end). Several edges may
share one curve [P42 5.5.5]. IP1 to IP7: the domain is the curve between the vertices, excluding
them; finite non-zero extent; a manifold; arcwise connected; vertex geometry consistent with the
curve. No parameter values are stored: the edge's interval is found by locating its vertices on the
curve (section 4.1). Vocabulary: `BrepEdge { Start; End; Curve; SameSense }`. In the survey, 1,743
of 341,403 edges are closed (start and end the same vertex instance); in the SolidWorks and Spatial
files all 525 of them are full circles;
same_sense is FALSE on 1,932 edges, nearly all written by Spatial [Survey].

**`oriented_edge`** (P42 5.5.6; `ORNEDG`) → `BrepEdgeUse`. Record
`ORIENTED_EDGE(name, *, *, edge_element: edge, orientation: BOOLEAN)`: edge_start and edge_end are
derived, edge_start = orientation ? element.edge_start : element.edge_end, edge_end the other
[P42 5.5.6, `boolean_choose`]. WR1: edge_element is not itself an oriented_edge. It is the "use" of an
edge in a loop. OpenCascade unwraps an oriented edge nested in another, against WR1 [OCC
StepToTopoDS_TranslateEdgeLoop.cxx, bug 29979].

**`path`** (P42 5.5.9; `PATH`). Record `PATH(name, edge_list: LIST[1:?] OF UNIQUE oriented_edge)`. WR1
`path_head_to_tail`: each oriented edge's edge_end is the same instance as the next one's edge_start.
IP3: edges meet only at common vertices; IP5: no two oriented edges with the same edge and the same
orientation.

**`loop`** (P42 5.5.13; `LOOP`). Record `LOOP(name)`. Supertype of `ONEOF(vertex_loop, edge_loop,
poly_loop)`. A closed topological curve (IP2); graph Euler equation (V − E_l) − (1 − G^l) = 0.

**`edge_loop`** (P42 5.5.15; `EDGLP`) → `BrepLoop.EdgeLoop`. Chain → (loop, path). Record
`EDGE_LOOP(name, edge_list: LIST[1:?] OF UNIQUE oriented_edge)`. WR1: the first oriented edge's
edge_start is the same instance as the last one's edge_end (`:=:`). IP1: V + G − E = 1 (vertices plus
genus minus edges). IP2: no edge appears twice with the same orientation; it may appear twice with
opposite orientations (a seam). It may "overlap itself" [P42 5.5.15]. A loop of one edge is a closed
edge (a full circle).

**`vertex_loop`** (P42 5.5.14; `VRTLP`) → `BrepLoop.VertexLoop`. Record `VERTEX_LOOP(name, loop_vertex: vertex)`.
A loop of one vertex, extent and dimension 0, genus 0. As a face bound it marks a point that bounds
the face, typically a pole or apex; a face whose only bound is a vertex_loop covers the whole of a
closed surface [P42 5.5.19]. In the survey: 7 OpenCascade and 1 Unigraphics complete spheres (the
vertex loop is the only bound), and 1 Unigraphics cone with a base circle and an apex vertex loop
[Survey].

**`poly_loop`** (P42 5.5.16; `PLYLP`) → `BrepLoop.PolyLoop`. Chain → (loop, geometric_representation_item).
Record `POLY_LOOP(name, polygon: LIST[3:?] OF UNIQUE cartesian_point)`. Straight segments between
consecutive points and from the last back to the first; coplanar (IP1); non-self-intersecting (IP2);
genus 1. Edges and vertices are implicit; two consecutive points A, B give an implicit oriented edge
A→B with orientation TRUE, and an edge B→A in another loop counts as the same edge reversed
[P42 5.5.16 NOTE 2]. Shared implicit edges are therefore matched by point identity (instance equality
of `cartesian_point`, or coincidence within tolerance when exporters duplicate points (unconfirmed
which exporters do)). Used only by faceted B-reps (`faceted_brep`, face WR1 forbids mixing loop
kinds).

**`face_bound`** (P42 5.5.17; `FCBND`) → `FaceBound { Loop; Orientation; IsOuter = false }`. Record
`FACE_BOUND(name, bound: loop, orientation: BOOLEAN)`. orientation FALSE means every oriented edge of
the loop is reversed when used in the face [P42 5.5.17]; `face_bound_reversed` flips the flag.

**`face_outer_bound`** (P42 5.5.18; `FCOTBN`) → `FaceBound { IsOuter = true }`. Record as face_bound.
It must separate the interior of the face from the exterior and enclose it; at most one per face. A
loop that does not enclose a domain, such as a circle around a cylinder, cannot be one
[P42 5.5.18 EXAMPLE 2]. Practice [Survey]: SolidWorks, Creo, Spatial (on advanced faces), Pro/ENGINEER,
Autodesk, CATIA and CADDS write a `face_outer_bound` on every face; OpenCascade, Unigraphics, Euclid,
ACIS and CAS.CADE never write one (all 21,731 OpenCascade faces use only `face_bound`). On cylinder
and cone bands bounded by two closed circles, Spatial (234 faces) and SolidWorks (20 faces) mark
**both** circles as outer, which violates `face` WR2, and SolidWorks (9) and Spatial (1) mark one of
them, against EXAMPLE 2; SolidWorks has 5 more faces with two outer bounds of other shapes. So the
outer loop must be determined by geometry when absent, and the flag treated as a hint when present.

**`face`** (P42 5.5.19; `FACE`). Record `FACE(name, bounds: SET[1:?] OF face_bound)`. A face is an
oriented, connected, finite 2-manifold without handles, possibly with holes, each bounded by a loop;
at least one bound; bounds distinct and non-intersecting; with an outer bound the others lie inside
it. The topological normal n is such that n × t points into the face for t the tangent of any
bounding loop (as used): loops run counter-clockwise seen from the side n points to. A vertex_loop
takes its sense from the other bounds or from the surface; a face whose only bound is a vertex_loop is
the whole (closed) surface [P42 5.5.19]. WR1: no mixing of poly_loops with other loop kinds; WR2: at
most one face_outer_bound. IP1: no edge used more than twice, or twice in the same direction; IP2:
distinct bounds share no vertex; IP3: loops do not intersect; IP4: Euler V − E − L + Σ G^l = 0
(V, E, L the face's vertices, edges and loops, G^l each loop's genus); IP5: loops unique. Not
instantiated alone in B-reps.

**`face_surface`** (P42 5.5.20; `FCSRF`) → `BrepFace`. Chain → (face, geometric_representation_item).
Record `FACE_SURFACE(name, bounds: SET[1:?] OF face_bound, face_geometry: surface, same_sense: BOOLEAN)`.
same_sense TRUE means the surface normal N agrees with the face's topological normal [P42 5.5.20].
The face is the part of the (possibly unbounded) surface cut out by the loops, embeddable in the
plane as an open disk with holes, though face plus boundary may cover a whole sphere or torus. WR1:
face_geometry is not an `oriented_surface`. IP1 to IP8: domain is the surface inside the loops,
excluding them; finite non-zero extent; a manifold; arcwise connected; surface genus 0; loops not in
the domain; loop geometry lies on the surface; loops do not intersect. Vocabulary:
`BrepFace { Surface; SameSense; Bounds }`. same_sense is FALSE on 48% of surveyed faces (64,000 of
133,000) [Survey]: it is the normal case for any face whose surface's natural normal points into the
material, such as a hole's cylinder.

**`advanced_face`** (AIC; `ADVFC`). Record as face_surface: `ADVANCED_FACE(name, bounds, face_geometry, same_sense)`.
WR1 to WR10 in section 3.5. Every face of an `advanced_brep_shape_representation`'s solids is one.

**`oriented_face`** (P42 5.5.21; `ORNFC`). Record `ORIENTED_FACE(name, *, face_element: face, orientation: BOOLEAN)`;
bounds derived by `conditional_reverse(orientation, face_element.bounds)`. WR1: element is not an
oriented_face. FALSE reverses the face: its normal and all its bounds [P42 5.6.7]. Forbidden in
advanced B-reps (advanced_brep WR3 requires `advanced_face`), but allowed in shells generally. None
in the survey.

**`connected_face_set`** (P42 5.5.23; `CNFCST`). Record `CONNECTED_FACE_SET(name, cfs_faces: SET[1:?] OF face)`.
IP1: the union of faces and their bounds is arcwise connected. Supertype of `ONEOF(closed_shell,
open_shell)`.

**`closed_shell`** (P42 5.5.28; `CLSSHL`) → `BrepShell { DeclaredClosed = true }`. Record
`CLOSED_SHELL(name, cfs_faces: SET[1:?] OF face)`. A connected, closed, oriented 2-manifold that bounds
a finite region; its normal points from the finite to the infinite region; every face's normal, after
any orientation flag, agrees with it (IP10). IP1: every edge referenced exactly twice by the faces'
bounds; IP2: each oriented edge use unique; IP3: no edge in more than two faces; IP4, IP5: faces and
edges meet only at shared edges and vertices; IP6: faces unique; IP7: no mixing of poly_loops; IP8:
an oriented arcwise-connected manifold; IP9: the Euler equation. The survey found 371 `closed_shell`s
with edges used once, all inside a `shell_based_surface_model`, almost all from Spatial (a few from
OpenCascade); every closed shell under a solid had every edge used exactly twice [Survey]. "Closed" in the file is a claim to
check.

**`open_shell`** (P42 5.5.26; `OPNSHL`) → `BrepShell { DeclaredClosed = false }`. Same record. A
connected, oriented 2-manifold with boundary, not closed; its boundary is the edges used once.
Faces unique, at least one edge used once, none more than twice; Euler equation (7) of section 7.
OpenCascade writes 2,939 of them in surface models [Survey].

**`oriented_closed_shell`** (P42 5.5.29; `ORCLSH`). Record
`ORIENTED_CLOSED_SHELL(name, *, closed_shell_element: closed_shell, orientation: BOOLEAN)`; cfs_faces
derived by `conditional_reverse`. WR1: element is not itself oriented. Used for voids, with
orientation FALSE (section 3.7). **`oriented_open_shell`** (5.5.27; `OROPSH`) is the open analogue.

### 3.7 Solids and surface models

**`solid_model`** (P42 6.4.1; `SLDMDL`). Record `SOLID_MODEL(name)`; supertype of `manifold_solid_brep`
and the CSG, swept and replica solids (out of scope).

**`manifold_solid_brep`** (P42 6.4.2; `MNSLBR`) → `BrepBody.ManifoldSolid(Outer)`. Record
`MANIFOLD_SOLID_BREP(name, outer: closed_shell)`. A finite, arcwise-connected volume bounded by one
or more closed shells; the outer shell's normal points away from the solid; any other shells are
voids (subtype brep_with_voids) enclosed by the outer and not by each other. Faces meet only at
edges; each edge borders at most one other face; the face's surface is a genus-0 manifold within
the face. Euler: V − E + 2F − L_l − 2(S − G^s) = 0 with V, E, F, L_l, S the numbers of distinct
vertices, edges, faces, face bounds and shells, G^s the summed shell genus. IP1 to IP12 (section 7):
dimension 3; Euler; no poly_loops unless faceted; distinct loops of a face share no vertex; all
topology has geometry; shell normals point away from the solid; each face, oriented edge use, and
edge-pair as required [P42 6.4.2]. In an `advanced_brep_shape_representation` the outer shell must not
be an `oriented_closed_shell` (advanced_brep WR4) and every face must be an `advanced_face` (WR3).

**`brep_with_voids`** (P42 6.4.3; `BRWTVD`) → `BrepBody.SolidWithVoids(Outer, Voids)`. Record
`BREP_WITH_VOIDS(name, outer: closed_shell, voids: SET[1:?] OF oriented_closed_shell)`. Each void is an
`oriented_closed_shell` with orientation FALSE, so its normals point into the void, away from the
material; void shells are disjoint from the outer shell and each other, enclosed by the outer but not
by another void (IP1 to IP3) [P42 6.4.3]. advanced_brep WR5 requires orientation FALSE. Five such
solids in the survey (SolidWorks, Creo, Spatial) [Survey]. In AP files `faceted_brep` and
`brep_with_voids` may combine (P42 6.4.2).

**`faceted_brep`** (P42 6.4.4; `FCTBR`). Record `FACETED_BREP(name, outer: closed_shell)`. All faces
planar and all edges straight; all bounds are poly_loops (IP1); faces may have explicit planes or
implicit ones (IP2). It meets the same constraints as `manifold_solid_brep`. In a
`faceted_brep_shape_representation`, faces must be `face_surface`s on `plane`s with exactly one
`face_outer_bound` (WR3, WR4) [AIM]. Decoding: vocabulary `PolyLoop`, with the plane taken from the
face_surface. A CATIA V4 sample is a faceted B-rep written with short names [Survey, `clip.stp`].

**`shell_based_surface_model`** (P42 6.4.44; `SBSM`) → `BrepBody.ShellSet(Shells)`. Record
`SHELL_BASED_SURFACE_MODEL(name, sbsm_boundary: SET[1:?] OF shell)` where `shell = SELECT(vertex_shell,
wire_shell, open_shell, closed_shell)`; WR1 restricts members to open and closed shells. Shells meet
only at shared faces, edges, vertices (IP2). This is the sheet-body representation, used inside
`manifold_surface_shape_representation` (section 3.8).

### 3.8 Representations, product structure, assemblies

A shape is found by walking from products to representations; the B-rep items sit in a
`shape_representation` (or a subtype) whose context gives the units and tolerance. The chain
[PDMUG 3.3, 4.4; AIM]:

```
product ← product_definition_formation ← product_definition ← product_definition_shape
        ← shape_definition_representation → shape_representation (items, context)
                                             ← shape_representation_relationship → advanced_brep_shape_representation
```

**`product`** (`PRDCT`). Record `PRODUCT(id, name, description?, frame_of_reference: SET[1:?] OF product_context)`.
**`product_definition_formation`** (`PRDFFR`; a version). Record
`PRODUCT_DEFINITION_FORMATION(id, description?, of_product: product)`; UR1 (id, of_product).
**`product_definition`** (`PRDDFN`; a view of a version, the node of the assembly tree). Record
`PRODUCT_DEFINITION(id, description?, formation, frame_of_reference: product_definition_context)`.
**`property_definition`** (`PRPDFN`) and its subtype **`product_definition_shape`** (`PRDFSH`). Record
`PRODUCT_DEFINITION_SHAPE(name, description?, definition: characterized_definition)`; for a part its
definition is the `product_definition`; for an assembly occurrence it is the
`next_assembly_usage_occurrence`. UR1: one shape per definition; WR1: the definition is a
characterized product definition or object [AIM].

**`shape_definition_representation`** (`SHDFRP`). Record
`SHAPE_DEFINITION_REPRESENTATION(definition: property_definition, used_representation: shape_representation)`
(the attributes of `property_definition_representation`, narrowed). WR1: definition is a
product_definition_shape or the definition of a shape_definition [AIM]. This is the link from a
part's product_definition_shape to its top shape_representation.

**`representation`** (P43 4.4.13; `RPRSNT`). Record `REPRESENTATION(name, items: SET[1:?] OF representation_item, context_of_items: representation_context)`.
**`shape_representation`** (`SHPRPR`) adds nothing. Exporters commonly put an `axis2_placement_3d`
(the part's origin) and `mapped_item`s in a plain shape_representation and link it to the
B-rep-bearing representation by a `shape_representation_relationship` [PDMUG 3.3; seen in the
Spatial and Autodesk files of the survey].

**`advanced_brep_shape_representation`** (`ABSR`). Record as representation. WR1: items are only
`manifold_solid_brep`, `faceted_brep`, `mapped_item`, `axis2_placement_3d`; WR2: at least one solid or
mapped item; WR3: every face of every solid shell is an `advanced_face`; WR4: no solid's outer shell is
an `oriented_closed_shell`; WR5: every void has orientation FALSE; WR6: every mapped item maps another
`advanced_brep_shape_representation` [AIC aic_advanced_brep]. This is the main B-rep container.

**`manifold_surface_shape_representation`** (`MSSR`). Items are `shell_based_surface_model`,
`mapped_item`, `axis2_placement_3d` (WR1, WR2); shells are open, closed or oriented closed (WR4);
faces are `face_surface`s (WR5) that are either advanced faces or pass `msf_surface_check` (WR6);
bounds are edge or vertex loops (WR7); edges are `edge_curve`s (WR8) on b_spline curves, conics,
curve replicas, lines, offset curves, pcurves, polylines or surface curves (WR9), checked further by
`msf_curve_check` (WR10); vertices are `vertex_point`s (WR11) on cartesian points, degenerate pcurves,
points on curves or points on surfaces (WR12 to WR14) [AIM]. This is where `offset_curve_3d`,
`pcurve` as edge geometry, and `degenerate_pcurve` vertices can legally appear.

**`faceted_brep_shape_representation`** (`FBSR`). Items are `faceted_brep`, `mapped_item`,
`axis2_placement_3d`; faces are `face_surface`s on `plane`s with a `cartesian_point` location (WR3) and
exactly one `face_outer_bound` (WR4); outer shell not oriented (WR5); voids orientation FALSE (WR6)
[AIM].

**`geometrically_bounded_surface_shape_representation`** (`GBSSR`). Items are `geometric_set`,
`mapped_item`, `axis2_placement_3d`; the sets hold points, curves and surfaces (including
`curve_bounded_surface` and `rectangular_trimmed_surface`) without topology (WR1 to WR7) [AIM]. No
B-rep; out of scope for meshing beyond a diagnostic (a trimmed-surface mesher could take it later).

**`shape_representation_relationship`** (`SHRPRL`). Record
`SHAPE_REPRESENTATION_RELATIONSHIP(name, description?, rep_1, rep_2)`; WR1: one side is a
shape_representation. Without a transformation it says that two representations describe the same
shape in the same space, for example a part's plain shape_representation and its
advanced_brep_shape_representation [PDMUG 3.3.1.1]. A reader follows these links from the
representation found by `shape_definition_representation` to reach the B-rep items.

**`representation_relationship_with_transformation`** (P43 4.4.21; `RRWT`). Adds
`transformation_operator: transformation`, `transformation = SELECT(item_defined_transformation,
functionally_defined_transformation, set_item_defined_transformation)`. WR1: the two
representations have different contexts. WR2 and IP1: with an item_defined_transformation,
transform_item_1 is in rep_1's context and transform_item_2 in rep_2's. Always the complex instance
`(REPRESENTATION_RELATIONSHIP(name, description, rep_1, rep_2)
REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(op) SHAPE_REPRESENTATION_RELATIONSHIP())`.

**`item_defined_transformation`** (P43 4.4.10; `ITDFTR`). Record
`ITEM_DEFINED_TRANSFORMATION(name, description?, transform_item_1: representation_item, transform_item_2: representation_item)`.
For rigid placement both items are `axis2_placement_3d`s; the transformation is the rigid motion that
carries frame 1 onto frame 2: with F(a) the 4×4 matrix of frame a (columns x, y, z, location),
p_in_rep2 = F(item_2) · F(item_1)⁻¹ · p_in_rep1 [P43 4.4.10 EXAMPLE 1; OCC STEPControl_ActorRead.cxx
ComputeTransformation, `Trsf.SetTransformation(ax3Targ, ax3Orig)`]. Recommended usage: rep_1 and
transform_item_1 belong to the component (related_product_definition of the NAUO), rep_2 and
transform_item_2 to the assembly (relating_product_definition) [PDMUG 4.4.2]. Exporters swap them:
OpenCascade checks which representation actually contains each placement and swaps with the warning
"Axis placements are swapped in SRRWT; corrected", and separately checks whether the relationship's
rep_1/rep_2 are reversed relative to the NAUO and inverts the transformation if so [OCC
STEPControl_ActorRead.cxx ComputeTransformation, `STEPConstruct_Assembly::CheckSRRReversesNAUO`]. The
PDMUG's own example 13 swaps the items relative to its recommendation [PDMUG 3.3.1.2]. Decide the
direction from membership, never from attribute position. The survey has 15,176
`item_defined_transformation`s, exactly one per NAUO for every exporter except Unigraphics (13 for
36 NAUOs; it places the rest with mapped items), and no `cartesian_transformation_operator_3d`
[Survey].

**`context_dependent_shape_representation`** (`CDSR`). Record
`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(representation_relation: shape_representation_relationship, represented_product_relation: product_definition_shape)`.
WR1: the product_definition_shape's definition is a product_definition_relationship (the NAUO). It
ties one placement (the relationship with transformation) to one occurrence (the NAUO), which is how
several occurrences of one component get distinct placements [PDMUG 4.4.2].

**`next_assembly_usage_occurrence`** (`NAUO`). Record
`NEXT_ASSEMBLY_USAGE_OCCURRENCE(id, name, description?, relating_product_definition, related_product_definition, reference_designator?)`.
The parent-child edge of the assembly tree: relating = assembly, related = component. UR1, UR2:
(reference_designator, relating) and (occurrence id, relating) unique.

**`mapped_item`** (P43 4.4.11; `MPPITM`). Record `MAPPED_ITEM(name, mapping_source: representation_map, mapping_target: representation_item)`.
**`representation_map`** (P43 4.4.18; `RPRMP`). Record `REPRESENTATION_MAP(mapping_origin: representation_item, mapped_representation: representation)`.
A mapped_item places a whole representation as one item of another: the source representation is
transformed so that mapping_origin lands on mapping_target, the same frame-to-frame rule as above
(origin = item 1, target = item 2) [P43 4.4.11 EXAMPLE]. mapped_item WR1: acyclic; representation_map
WR1: the origin is in the mapped representation's context. The target may be a
`cartesian_transformation_operator_3d` instead of a placement, which allows scaling and mirroring
(unconfirmed in practice). Unigraphics uses mapped items for assembly structure (23 in the survey);
the styling practice uses an identity mapped item to attach styles [STY 4.1].

Resolution algorithm (what `03-step` needs, distilled from [PDMUG 4.4] and [OCC STEPControl_ActorRead.cxx]):

1. Collect every `shape_representation` (and subtype) that contains B-rep items (`manifold_solid_brep`,
   `brep_with_voids`, `faceted_brep`, `shell_based_surface_model`) or `mapped_item`s.
2. For each `product_definition`, find its shape via `product_definition_shape` and
   `shape_definition_representation`, then follow `shape_representation_relationship`s without
   transformation to the representations holding solids.
3. For each NAUO, find the `context_dependent_shape_representation` whose
   `represented_product_relation` is the NAUO's `product_definition_shape`; its relationship gives the
   component representation, the assembly representation, and the transformation. Decide which side
   is the component by matching to the NAUO's related product definition.
4. For `mapped_item`s, compose origin-to-target transforms recursively (acyclic by WR1).
5. Every solid instance is then (solid, accumulated transform, context). Contexts may differ between
   parts (units, uncertainty); OpenCascade re-reads the units of each representation's context
   [OCC STEPControl_ActorRead.cxx PrepareUnits].

The vocabulary's `BrepModel` is one model with one `Unit` and one `Tolerances`; an assembly whose
parts use different units or uncertainties has to be normalized at decode time (convert to one unit,
take the largest uncertainty, or decode each part as its own model). This is an open question for
`03-step` and `08-pipeline` (section 9).

**Tessellated geometry, out of scope.** AP242 adds `tessellated_shape_representation` (P42 6.4.52) and
the items under `tessellated_item` (6.4.53): `coordinates_list`, `tessellated_vertex`,
`tessellated_edge`, `tessellated_connecting_edge`, `tessellated_face`, `triangulated_face`,
`complex_triangulated_face`, `cubic_bezier_tessellated_edge`, `cubic_bezier_triangulated_face`,
`tessellated_solid`, `tessellated_shell`, `tessellated_wire`, `tessellated_surface_set`,
`triangulated_surface_set`, `complex_triangulated_surface_set`, `tessellated_curve_set`,
`tessellated_geometric_set`, `tessellated_point_set`, `repositioned_tessellated_item`,
`tessellated_structured_item`, and `tessellated_shape_representation_with_accuracy_parameters`
(6.4.54 to 6.4.75), with the CAx-IF practice [rec_prac_3dtess_geo_v11]. They carry meshes, not exact
geometry; a file may hold them beside a B-rep. The decoder should skip them with an Info diagnostic.
OpenCascade reads them only when no B-rep is present, by default [OCC StepToTopoDS_TranslateFace.cxx
`theReadTessellatedWhenNoBRepOnly`].

### 3.9 Short names

The short name, when a file uses short names, replaces the long name everywhere [P21 12.2.11]. From
[SN] for the catalogue entities:

| Entity | Short | Entity | Short | Entity | Short |
|---|---|---|---|---|---|
| advanced_brep_shape_representation | ABSR | edge_loop | EDGLP | plane_angle_unit | PLANUN |
| advanced_face | ADVFC | ellipse | ELLPS | poly_loop | PLYLP |
| axis1_placement | AX1PLC | evaluated_degenerate_pcurve | EVDGPC | polyline | PLYLN |
| axis2_placement_2d | A2PL2D | face_bound | FCBND | product | PRDCT |
| axis2_placement_3d | A2PL3D | face_outer_bound | FCOTBN | product_definition | PRDDFN |
| b_spline_curve | BSPCR | face_surface | FCSRF | product_definition_formation | PRDFFR |
| b_spline_curve_with_knots | BSCWK | faceted_brep | FCTBR | product_definition_shape | PRDFSH |
| b_spline_surface | BSPSR | faceted_brep_shape_representation | FBSR | quasi_uniform_curve | QSUNCR |
| b_spline_surface_with_knots | BSSWK | geometric_representation_context | GMRPCN | quasi_uniform_surface | QSUNSR |
| bezier_curve | BZRCRV | geometric_representation_item | GMRPIT | rational_b_spline_curve | RBSC |
| bezier_surface | BZRSRF | geometrically_bounded_surface_shape_representation | GBSSR | rational_b_spline_surface | RBSS |
| bounded_curve | BNDCRV | global_uncertainty_assigned_context | GC | rectangular_trimmed_surface | RCTRSR |
| bounded_surface | BNDSRF | global_unit_assigned_context | GUAC | representation | RPRSNT |
| brep_with_voids | BRWTVD | hyperbola | HYPRBL | representation_context | RPRCNT |
| cartesian_point | CRTPNT | intersection_curve | INTCRV | representation_item | RPRITM |
| cartesian_transformation_operator_3d | CTO3 | item_defined_transformation | ITDFTR | representation_map | RPRMP |
| circle | CIRCLE | length_measure_with_unit | LMWU | representation_relationship | RPRRLT |
| closed_shell | CLSSHL | length_unit | LNGUNT | representation_relationship_with_transformation | RRWT |
| composite_curve | CMPCRV | line | LINE | seam_curve | SMCRV |
| composite_curve_segment | CMCRSG | manifold_solid_brep | MNSLBR | shape_definition_representation | SHDFRP |
| conical_surface | CNCSRF | manifold_surface_shape_representation | MSSR | shape_representation | SHPRPR |
| context_dependent_shape_representation | CDSR | mapped_item | MPPITM | shape_representation_relationship | SHRPRL |
| conversion_based_unit | CNBSUN | measure_with_unit | MSWTUN | shell_based_surface_model | SBSM |
| curve | CURVE | named_unit | NMDUNT | si_unit | SUNT |
| curve_bounded_surface | CRBNSR | next_assembly_usage_occurrence | NAUO | solid_angle_unit | SLANUN |
| cylindrical_surface | CYLSRF | offset_curve_3d | OFCR3D | spherical_surface | SPHSRF |
| definitional_representation | DFNRPR | offset_surface | OFFSRF | surface | SRFC |
| degenerate_pcurve | DGNPCR | open_shell | OPNSHL | surface_curve | SRFCRV |
| degenerate_toroidal_surface | DGTRSR | oriented_closed_shell | ORCLSH | surface_of_linear_extrusion | SL |
| dimensional_exponents | DMNEXP | oriented_edge | ORNEDG | surface_of_revolution | SROFRV |
| direction | DRCTN | oriented_face | ORNFC | toroidal_surface | TRDSRF |
| edge | EDGE | parabola | PRBL | trimmed_curve | TRMCRV |
| edge_curve | EDGCRV | parametric_representation_context | PRRPCN | uncertainty_measure_with_unit | UMWU |
| | | pcurve | PCURVE | vector | VECTOR |
| | | plane | PLANE | vertex_loop | VRTLP |
| | | plane_angle_measure_with_unit | PAMWU | vertex_point | VRTPNT |

`seam_edge` has no entry in the table [SN, checked 2026-10-17].

## 4. Sense and orientation, composed

Write σ(b) = +1 for TRUE and −1 for FALSE. Four flags decide how a face uses a curve and a surface;
two more (oriented face, oriented shell) and the determinant of an instance transformation decide how
the face sits in the solid.

### 4.1 The flags one at a time

| Flag | Says | Source |
|---|---|---|
| `edge_curve.same_sense` = s | σ(s) = +1: the edge runs from edge_start to edge_end in the direction of increasing curve parameter. σ(s) = −1: it runs against it | P42 5.5.5 |
| `oriented_edge.orientation` = o | σ(o) = +1: the use runs edge_start to edge_end of the edge; −1: end to start. The use's own edge_start/edge_end are derived accordingly | P42 5.5.6 |
| `face_bound.orientation` = b | σ(b) = −1: every oriented edge of the loop is reversed in this face, so the loop runs backwards | P42 5.5.17, 5.6.6 |
| `face_surface.same_sense` = f | σ(f) = +1: the surface normal N agrees with the face's topological normal n; −1: n = −N | P42 5.5.20 |
| Face interior rule | n × t points into the face, for t the tangent of any bounding loop as used: each loop runs counter-clockwise seen from the side n points to; outer loops enclose, inner loops run the other way round the holes | P42 5.5.19 |
| `oriented_face.orientation`, `oriented_closed_shell.orientation` | FALSE reverses the face (normal and all bounds) or every face of the shell | P42 5.5.21, 5.5.29, 5.6.2, 5.6.7 |
| Shell and solid normals | A closed shell's normal points from its finite region outward; a manifold solid's boundary normal points away from the material; void shells are oriented_closed_shells with orientation FALSE, so they too end up pointing away from the material (into the void) | P42 5.5.28 IP10, 6.4.2, 6.4.3 |

Edge interval. The file stores no parameters for an edge. Let t_s and t_e be the curve parameters
of the vertex points of edge_start and edge_end, found by inverse evaluation on the curve (within
the length tolerance). The edge's interval on the curve, traversed start to end, is

- σ(s) = +1: from t_s increasing to t_e; on a periodic curve, t_e is replaced by the representative
  in (t_s, t_s + P]; a closed edge (edge_start and edge_end the same vertex instance) on a periodic
  curve covers one full period, [t_s, t_s + P].
- σ(s) = −1: from t_s decreasing to t_e; on a periodic curve t_e is the representative in
  [t_s − P, t_s).

OpenCascade does exactly this: it orders the vertices by same_sense, projects both onto the curve,
and builds the edge on [U1, U2] in the curve's direction; if a closed curve has two distinct vertices
at one point it merges them ("Wrong topology corrected: Closed Edge with TWO different Vertices"); if
the projection misses by more than the tolerance it enlarges the vertex tolerance and warns ("Poor
result from projection vertex / curve 3d") [OCC StepToTopoDS_TranslateEdge.cxx MakeFromCurve3D]. The
vocabulary's `EdgeDomain(m, e)` is this interval.

### 4.2 The composed formulas

**Direction of a coedge along its curve.** For an oriented edge with flags s (its edge_curve), o (its
own orientation), inside a face_bound with flag b,

  κ = σ(s) · σ(o) · σ(b).

κ = +1: the coedge, as the face uses it, runs in the direction of increasing curve parameter, over the
edge interval of section 4.1; κ = −1: decreasing. The same κ applies to the edge's pcurve on this
face, because a pcurve has the same sense as its 3D curve [P42 4.5.49 IP2]. Under `oriented_face`
and `oriented_closed_shell` multiply by σ of their orientation flags too; they reverse loops and
normal together, so the side rule below does not change. OpenCascade stores the same information as
an edge orientation FORWARD iff σ(o) = σ(s), a wire orientation FORWARD iff σ(b) = σ(f), and a face
orientation FORWARD iff σ(f) = +1; composing them gives κ [OCC StepToTopoDS_TranslateEdgeLoop.cxx
lines setting `E.Orientation`, StepToTopoDS_TranslateFace.cxx `anEdgeLoopWire.Orientation`].

**Face normal.** The topological normal of the face as used by its shell is

  n(u,v) = σ(f) · σ(oriented_face) · σ(oriented_shell) · N(u,v),  N = ε · <σ_u × σ_v>,

with ε = −1 only for the lemon part of a `degenerate_toroidal_surface` (select_outer FALSE) and
ε = +1 for every other surface in this catalogue (section 3.5). In a valid closed shell of a solid, n
points away from the material everywhere. The mesh layer winds triangles counter-clockwise about n.

**Which side of a coedge the face lies on, in the surface's (u,v) plane.** Orient the (u,v) plane so
that the u axis turned 90° counter-clockwise gives the v axis; this orientation corresponds to
σ_u × σ_v. Then, for a coedge traversed with direction κ along its pcurve,

  the face interior lies to the left of the coedge iff σ(f) · ε = +1, and to the right otherwise.

Consequences for `05-face-meshing`: with σ(f)·ε = +1 an outer loop has positive signed area in (u,v)
and inner loops negative; with σ(f)·ε = −1 the signs swap. This holds for loops that close in (u,v);
on a periodic surface a loop that winds around the period (a circle on a cylinder) does not close,
and only the left/right rule applies (section 6.2).

**Mirroring instances.** If an instance transform T (mapped_item, assembly placement,
cartesian_transformation_operator) has det T = −1, the transformed normal is T·n, which still points
away from the material, but the bounding loops now run clockwise about it: the interior lies to the
right [P42 4.5.20]. Triangles of a mirrored instance must have their vertex order reversed. Assembly
placements are rigid motions with det T = +1 [PDMUG 4.4]; mirrors can arise only through a
`cartesian_transformation_operator`, and none appeared in the survey.

### 4.3 Worked example: a solid cylinder

A cylinder of radius 10 and height 20, axis along +z, as Euclid or OpenCascade 7.3 would write it
(one side face with a seam). Placement A: location (0,0,0), axis (0,0,1), ref_direction (1,0,0).

```
#1 = CYLINDRICAL_SURFACE('', #A, 10.);                    σ(u,v) = (10 cos u, 10 sin u, v), N outward
#2 = CIRCLE('', #A, 10.);                                 C0(t) = (10 cos t, 10 sin t, 0)
#3 = CIRCLE('', #A20, 10.);                               C1(t) = (10 cos t, 10 sin t, 20)  (#A20 at z = 20)
#4 = LINE('', #P0, #V);                                   L(t) = (10, 0, 0) + t (0, 0, 1)
#10 = VERTEX_POINT('', #P0);                              (10, 0, 0)
#11 = VERTEX_POINT('', #P20);                             (10, 0, 20)
#20 = EDGE_CURVE('', #10, #10, #2, .T.);                  Eb: bottom circle, closed edge
#21 = EDGE_CURVE('', #11, #11, #3, .T.);                  Et: top circle, closed edge
#22 = EDGE_CURVE('', #10, #11, #4, .T.);                  Es: seam, upwards
#30 = EDGE_LOOP('', (#31, #32, #33, #34));
#31 = ORIENTED_EDGE('', *, *, #20, .T.);                  Eb forward
#32 = ORIENTED_EDGE('', *, *, #22, .T.);                  Es up
#33 = ORIENTED_EDGE('', *, *, #21, .F.);                  Et backward
#34 = ORIENTED_EDGE('', *, *, #22, .F.);                  Es down
#35 = FACE_BOUND('', #30, .T.);
#36 = ADVANCED_FACE('', (#35), #1, .T.);                  side face
```

Check the loop closes head to tail: #31 V0→V0, #32 V0→V20, #33 V20→V20, #34 V20→V0 (edge_loop WR1
holds; IP2 holds: Es appears twice, with opposite orientations).

Composed directions, κ = σ(s)σ(o)σ(b): Eb +1 (t increasing, counter-clockwise seen from +z), Es first
use +1 (t increasing, upwards), Et −1 (decreasing), Es second use −1 (downwards).

Normal: σ(f) = +1, N = cos u·x + sin u·y outward, so n points outward, away from the material. ✓

3D interior rule at the start vertex (10,0,0), on Eb: t = d/dt C0 = (0, 10, 0) → (0,1,0);
n × t = (1,0,0) × (0,1,0) = (0,0,1): up, into the side face. ✓ On Et at (10,0,20), traversed backwards:
t = (0,−1,0); n × t = (0,0,−1): down, into the face. ✓

(u,v) picture: the face is the rectangle u ∈ [0, 2π], v ∈ [0, 20]. Eb's pcurve is v = 0 traversed
with u increasing (κ = +1), Et's is v = 20 traversed with u decreasing. σ(f)ε = +1, so the interior is
to the left of each coedge: left of "u increasing at v = 0" is v > 0. ✓ The seam's two uses: the
upward use (κ = +1) must have the interior on its left, that is at smaller u, so it is the pcurve
u = 2π; the downward use (κ = −1) has the interior on its left at larger u, so it is u = 0. Traversed
in loop order, (0,0) → (2π,0) → (2π,20) → (0,20) → (0,0): counter-clockwise, positive area. ✓ This is
how a reader assigns the two pcurves of a `seam_curve` to the two uses when the file does not say
(section 6.2).

The caps. The bottom cap lies on a plane; its outward normal is −z. Two equivalent encodings:

- `PLANE` with axis (0,0,1) and the face's same_sense `.F.`: n = −z. The loop must run
  counter-clockwise seen from below, which is clockwise seen from above, so it uses Eb backwards:
  `ORIENTED_EDGE('',*,*,#20,.F.)` in a `FACE_BOUND(...,.T.)`. κ = −1.
- `PLANE` with axis (0,0,−1) and same_sense `.T.`: the same face with N = −z.

The top cap has n = +z and uses Et forwards (κ = +1). Across the shell, Eb is used once forwards (side)
and once backwards (bottom), Et once backwards (side) and once forwards (top), and Es twice in the side
face in opposite directions: every edge twice, in opposite directions, as closed_shell IP1 and
manifold_solid_brep IP9 require. Euler: V = 2, E = 3, F = 3, L_l = 3, S = 1, G = 0:
2 − 3 + 6 − 3 − 2(1 − 0) = 0. ✓

Without the seam (Spatial's form), the side face has two bounds, a loop of Eb alone and a loop of Et
alone (`FACE_BOUND((Eb,.T.)),.T.` and `FACE_BOUND((Et,.F.)),.T.`), V = 2, E = 2, F = 3, L_l = 4:
2 − 2 + 6 − 4 − 2 = 0. ✓ Both forms are valid STEP. In (u,v) the side face is then the annulus-like
strip between two loops that each wrap the period, and the mesher has to cut a seam itself.

## 5. Parameterization facts

### 5.1 Units of parameters, and what the decoder converts

Angular parameters take the context's plane-angle unit [P42 4.2.3]; length parameters take the
length unit of the context (for a plane, "the length unit for the unit vectors x and y is derived
from the context of the plane" [P42 4.5.59]); B-spline and polyline parameters are dimensionless
[P41 `parameter_value`]. In the survey, degrees are assigned by Creo (2 files, 2020
and 2022), Pro/ENGINEER (2), Unigraphics (3), CATIA V4 (1), CADDS (2) and ACIS (1); radians by
SolidWorks (41), OpenCascade and CAS.CADE (28), Spatial (18), Euclid (2), Autodesk (1) and a Theorem
translator (1) [Survey].

| Quantity | Unit in the file | Decode to (kernel, radians and model units) |
|---|---|---|
| circle, ellipse parameter u; trim values on them | angle | × angle factor (radians per file unit) |
| hyperbola, parabola parameter | dimensionless | as is |
| line parameter u; trim values on a line | multiples of \|V\| | as is (keep V with its magnitude) |
| polyline, B-spline, composite curve parameter | dimensionless | as is |
| `conical_surface.semi_angle` | angle | × angle factor |
| cylinder, cone, sphere, torus, revolution: u | angle | × angle factor |
| sphere, torus: v | angle | × angle factor |
| cylinder, cone: v | length (axial) | × length factor if converting units, else as is |
| plane: u, v | length | as above |
| extrusion: v | multiples of \|V\| | as is |
| pcurve (u, v) coordinates on the surfaces above | the surface's parameter units | each coordinate as its surface parameter: OpenCascade multiplies u by the angle factor on cylinder, cone, sphere, torus and revolution, v by the angle factor on sphere and torus, v by the length factor on cylinder and plane, and v by length/cos α on a cone (its own parameterization) [OCC GeomConvert_Units.cxx DegreeToRadian] |
| `rectangular_trimmed_surface` u1, u2, v1, v2 | the basis's parameter units | as pcurves [OCC StepToGeom.cxx MakeRectangularTrimmedSurface] |
| knot values, weights | dimensionless | as is |

Converting a pcurve affinely per axis keeps a 2D line a line and a 2D B-spline a B-spline (scale the
control points), but a 2D circle or ellipse in (u,v) with unequal scale factors becomes an ellipse
with different axes; OpenCascade converts 2D circles and ellipses to B-splines before scaling
[OCC GeomConvert_Units.cxx]. Whether exporters that write degrees also write pcurve u coordinates in
degrees could not be confirmed: no surveyed degree file has pcurves (unconfirmed). Follow P42 4.2.3
and OpenCascade.

The degree factor in files is written with 10 to 15 significant digits (0.0174532925 by Unigraphics
and CADDS, 0.01745329251994 by Pro/ENGINEER and Creo) [Survey]; over a full turn the 10-digit value is off by
about 7e-9 rad. Snap a factor within 1e-8 relative of π/180 to π/180 (recommendation; unconfirmed
what other readers do). OpenCascade takes the factor as written [OCC STEPConstruct_UnitContext.cxx].

### 5.2 Domains, periods and degenerate boundaries

| Entity | u domain, period | v domain, period | Degenerate boundary (σ_u or σ_v = 0) |
|---|---|---|---|
| line | (−∞, ∞) | | |
| circle, ellipse | [0, 2π), 2π | | |
| hyperbola, parabola | (−∞, ∞) | | |
| polyline (n points) | [0, n−1] | | |
| B-spline curve | [u_0, u_{k−d+1}] (5.3) | | |
| plane | (−∞, ∞) | (−∞, ∞) | none |
| cylinder | [0, 2π), 2π | (−∞, ∞) | none |
| cone | [0, 2π), 2π | (−∞, ∞), axial | apex at v = −R/tan α |
| sphere | [0, 2π), 2π | [−π/2, π/2] | poles v = ±π/2 |
| torus, R > r | [0, 2π), 2π | [0, 2π), 2π | none |
| torus, R = r | [0, 2π), 2π | [0, 2π), 2π | the circle v = π shrinks to C |
| torus, R < r (plain toroidal_surface) | [0, 2π), 2π | [0, 2π), 2π | self-intersecting; σ_u = 0 at cos v = −R/r |
| degenerate torus, apple (select_outer TRUE) | [0, 2π), 2π | [−φ, φ], r cos φ = −R | v = ±φ (on the axis) |
| degenerate torus, lemon (select_outer FALSE) | [0, 2π), 2π | [φ, 2π − φ] | v = φ, 2π − φ (on the axis) |
| surface of revolution | [0, 2π), 2π | the curve's domain | any v end where λ(v) is on the axis |
| surface of linear extrusion | the curve's domain | (−∞, ∞) | where λ'(u) ∥ V (excluded) |
| B-spline surface | per direction as curves | per direction | any side whose control points coincide |
| rectangular trimmed surface | [min(u1,u2), max(u1,u2)] in basis terms | same for v | inherited |
| offset surface | as basis | as basis | inherited, plus where the offset passes a centre of curvature |

The vocabulary's `DegenerateSides(g, s)` returns the sides of the face's own (u,v) box that collapse;
for unbounded surfaces that is a property of the face's range, not of the surface alone (a cone's apex
is a side only if the face reaches it). `Periodicity` is `Periodic(2π)` for every angular direction
above; a closed but clamped B-spline is geometrically closed without being periodic (its domain is
bounded), which `Periodicity` cannot express on its own (section 9).

### 5.3 B-spline knots

**Expansion.** Given distinct knots κ_1 < ... < κ_L and multiplicities m_1..m_L, the knot array
repeats each κ_j m_j times: [κ_1 ×m_1, ..., κ_L ×m_L], which ISO indexes u_{−d} .. u_{k+1}, k + d + 2
values for k+1 control points [P42 4.5.34 b, c; 4.5.35]. Constraints (WR1 via
constraints_param_b_spline, P42 4.6.11): Σ m_j = d + k + 2; 1 ≤ m_1, m_L ≤ d + 1; 1 ≤ m_j ≤ d for
interior knots; κ strictly increasing; d ≥ 1; k ≥ d.

**Domain.** In 0-based indexing of the expanded array T[0 .. k+d+1], the curve is defined on
[T[d], T[k+1]], which in ISO's indexing is [u_0, u_{k−d+1}] (derived from the basis definition on
[u_{i−d}, u_{i+1}]; P42 states the array, not the domain (unconfirmed wording)). Example: d = 3,
6 control points (k = 5), knots (0, 1, 2), multiplicities (4, 2, 4): T = [0,0,0,0,1,1,2,2,2,2]; domain
[T[3], T[6]] = [0, 2]. With end multiplicities d+1 the curve passes through its first and last
control points; with smaller end multiplicities it does not, and evaluation outside the domain is
undefined.

**Implied knots** [P42 4.5.36 to 4.5.38, 4.6.18, 4.6.19]:

| Subtype | Distinct knots L | Multiplicities | Knot values |
|---|---|---|---|
| `uniform_curve` | k + d + 2 | all 1 | −d, −d+1, ..., k+1 |
| `quasi_uniform_curve` | k − d + 2 | d+1, 1, ..., 1, d+1 | 0, 1, ..., k−d+1 |
| `bezier_curve` (piecewise) | k/d + 1 | d+1, d, ..., d, d+1 | 0, 1, ..., k/d |

The copy read gives L for the quasi-uniform curve as k + d + 2 and for the Bézier curve as
k/(d+1), both inconsistent with Σ m = k + d + 2; the values above satisfy it, and agree with the
corresponding surface notes (L = K − d + 2 and K/d + 1) [P42 4.5.37 NOTE, 4.5.38 NOTE 3, 4.5.75 NOTE,
4.5.76 NOTE]. A piecewise Bézier curve needs k to be a multiple of d. Surfaces apply the same per
direction. OpenCascade starts uniform knots at 0 and reads every `bezier_curve` and `bezier_surface`
as a single segment [OCC StepToGeom.cxx]; ours should follow ISO.

**Periodic splines.** STEP has no periodic flag. A smooth closed B-spline is written either clamped
with coincident first and last control points (closed, C0 or better at the join depending on the
data) or as a "wrapped" spline with uniform or unclamped knots and the first d control points repeated
at the end. `closed_curve`, `u_closed`, `v_closed` are information only and may be wrong [P42 4.5.34
NOTE 10]. OpenCascade infers periodicity from the knot sums (Σ m − m_1 = number of poles with
m_1 = m_L) and from `closed_curve` plus geometric closure, and makes closed B-spline face surfaces
periodic [OCC StepToGeom.cxx MakeBSplineCurveCommon, MakeBSplineSurface;
StepToTopoDS_TranslateFace.cxx]. Ours should decide closure geometrically within tolerance.

**Repairs OpenCascade applies** [OCC StepToGeom.cxx MakeBSplineCurveCommon, MakeBSplineSurface]:
consecutive knots equal within machine epsilon are merged and their multiplicities summed; an end
multiplicity above d+1 is cut to d+1 and the same number of control points dropped from that end
(curves only). The survey found no B-spline curve needing either [Survey].

**`self_intersect`** is information only for B-splines, offset curves and surfaces and composite
curves; `closed_curve` of a `composite_curve` is derived from the last transition code and so is
reliable as data, though not necessarily as geometry [P42 4.5.44].

### 5.4 Curves on surfaces: two parameterizations

A `surface_curve` has a 3D curve and up to two pcurves for the same point set, each with its own
parameter; only their senses must agree [P42 4.5.49 IP1, IP2]. `master_representation` names the one
that defines the curve's parameterization and evaluation; the others are approximations kept for
convenience [P42 4.2.6]. Practical rules:

- The 3D curve is what an edge is, for vertex projection and for the shape of the mesh along the
  edge. The pcurve, if present, says where the edge lies in a face's (u,v) plane. Map between them
  by matching points (inverse evaluation on the surface), not by assuming equal parameters.
- A pcurve on a periodic surface fixes which copy of the period the edge uses in that face; this is
  the information a mesher needs most, and when no pcurve exists the mesher must reconstruct it by
  projecting the 3D curve and unwrapping (fact 7).
- OpenCascade drops pcurves on planes and recomputes them [OCC StepToTopoDS_TranslateEdgeLoop.cxx
  CheckPCurves, `isPlane`], checks every pcurve against its 3D curve, and removes a pcurve whose
  parameter range is empty [same, `w1 == w2 illegal => Drop the PCurve`]. It has a mode that reads
  only pcurves or only 3D curves (`read.surfacecurve.mode`).
- `edge_curve_pcurves` collects pcurves from three places: the edge geometry itself if it is a
  pcurve, the associated geometry of a `surface_curve` edge geometry, and every other `surface_curve`
  in the file whose `curve_3d` is the edge's curve instance [P42 5.2.2.1, 5.6.4]. The third route
  means a pcurve can be attached to an edge without the edge referencing it. In the survey every
  pcurve sits in a `surface_curve` that is itself an edge's geometry (the second route): for
  OpenCascade, 9,818 pcurves in 4,909 surface and seam curves [Survey].
- Matching a pcurve to the face that uses it: compare the pcurve's basis_surface with the face's
  face_geometry by instance identity; two pcurves on the same surface (a seam) need connectivity in
  (u,v) to tell them apart [P42 5.2.2.1 NOTE 2].

## 6. Practice: what files actually contain

### 6.1 The survey

A script written for this document (in the session scratchpad, not committed) parsed 103 Part 21
files and counted entity kinds, units, uncertainties, seam and pole conventions, outer bounds, and
per-shell edge use and Euler characteristic. Further scripts classified periodic faces, poles and
apexes, vertex parameters on lines and circles, and closed shells by the representation using them.

| Source | Files | Exporters | Notes |
|---|---|---|---|
| u-blox 3D-Step-Models-Library, <https://github.com/u-blox/3D-Step-Models-Library> | 88 | SolidWorks 2011 to 2024 (41), OpenCascade 6.2 to 7.6 incl. FreeCAD (27), Spatial InterOp 3D (18), Creo 2022 (1), Autodesk Translation Framework (1) | Electronic modules: boards, shields, connectors; assemblies |
| NASA 3D Resources, <https://github.com/nasa/NASA-3D-Resources> | 1 | Creo 2020 | `rassor_shrinkwrap.stp`, a rover assembly; with the u-blox files, 6.3 million instances and 131,623 faces |
| STEP Tools sample files, <https://www.steptools.com/docs/stpfiles/> | 12 | Unigraphics 10.5, 13, 16; Pro/ENGINEER; CATIA V4 (2); CADDS 5 (2); ACIS; Euclid via CAS.CADE; Theorem | Older (1998 to 2002) AP203 and AP214 files |
| OpenCascade `data/step/` | 2 | Euclid | `screw.step`, `linkrods.step`: seam curves, pcurves |

The sample is small and skewed (electronics parts; no CATIA V5, NX recent, Inventor native, or
Onshape). Treat percentages as indications.

### 6.2 Periodic faces and seams

STEP does not require seams. A face on a cylinder, cone, sphere, torus, surface of revolution, or
closed B-spline can be bounded in three ways, all valid:

1. **A seam edge.** One edge is used twice in one loop, once in each direction, along a line of
   constant u where the parameterization wraps. The loop is then a topological disk boundary, and in
   (u,v) it closes once the seam is drawn at both u = 0 and u = 2π (section 4.3). The edge geometry
   is a `seam_curve` with two pcurves on the same surface [P42 4.5.51], or a `surface_curve` with two
   pcurves on the same surface, or a bare 3D curve with no pcurves at all.
2. **Two (or more) loops that each wrap the period**, and no seam: a cylinder band bounded by two
   circles. Valid by face IP4 and the Euler check of section 4.3; P42 5.5.18 EXAMPLE 2 notes that
   such a circle cannot be an outer bound.
3. **Split faces.** The exporter cuts the periodic surface into faces that each span less than one
   period (often two halves), so no face needs a seam.

Classification of every face on a cylinder, cone, sphere or torus [Survey]: "seam" if a loop uses an
edge twice; "band" if no seam and two or more loops consist only of closed edges (each wraps the
period); "wrapping loop" if the only loop is closed edges (a hemisphere bounded by its equator, the
pole inside the face); "split" otherwise.

| Exporter | Cylinder faces: seam / band / split | Cone | Sphere | Torus |
|---|---|---|---|---|
| SolidWorks | 0 / 20 / 6,967 | 0 / 9 / 224 | 0 / 0 / 150 | 0 / 0 / 399 |
| Creo | 0 / 0 / 5,602 | 0 / 0 / 385 | 0 / 0 / 110 | 0 / 0 / 368 |
| Spatial | 0 / 234 / 1,375 | 0 / 1 / 64 | 12 wrapping loop | 0 / 1 / 60 |
| OpenCascade | 521 / 0 / 1,450 | 0 / 0 / 48 | 0 / 0 / 95 | 0 / 0 / 160 |
| Unigraphics | 0 / 20 / 866 | 0 / 1 / 130 | 0 / 0 / 1 | 0 / 3 / 2 |
| Autodesk | 37 / 0 / 113 | 2 / 0 / 3 | 2 / 0 / 56 | 3 / 0 / 38 |
| Euclid (OpenCascade samples) | 5 / 0 / 0 | 2 / 0 / 0 | | 4 / 0 / 8 |
| Pro/ENGINEER, CAS.CADE, CATIA V4 | 0 / 0 / 78 | 0 / 0 / 22 | | 0 / 0 / 2 |

In every seam found, the two uses had opposite orientations, as edge_loop IP2 and face IP1 require
(577 of 577) [Survey].

What a reader must do:

- Detect seams by topology (same edge twice in one face), not by entity type, and assign each use a
  copy of the period: the use with the face on its left (when σ(f)ε = +1) runs along the higher-u
  copy when going up in v (section 4.3). With pcurves, the two pcurves are the two copies, and which
  use takes which is not recorded except by `seam_edge` (never seen); OpenCascade decides
  geometrically (`ShapeAnalysis_Curve::SelectForwardSeam`) and fails the edge with "Seam curve not
  mapped" if it cannot [OCC StepToTopoDS_TranslateEdgeLoop.cxx].
- For case 2, cut a seam: choose a constant-u line that crosses the face, split the face's (u,v)
  region there, and treat the cut as an internal edge whose two sides are meshed with the same
  points. OpenCascade adds the missing seam in shape healing (`FixMissingSeamMode`) [OCC
  resources/XSTEPResource/STEP]; its face translator notes the case ("face with two edges whose seam
  is missing") [OCC StepToTopoDS_TranslateFace.cxx].
- Edges along a seam of a split face (case 3) are ordinary edges shared by two faces.

### 6.3 Poles and apexes

A pole of a sphere, the apex of a cone, the centre of a horn torus, and the axis points of a
degenerate torus or of a revolved profile touching the axis are points where a side of the (u,v)
rectangle collapses. STEP topology cannot put an edge there: edges have non-zero extent (edge IP2,
edge_curve IP2) and the standard requires model-space topology without degenerate edges [P42 5.2.2].
Four cases remain:

1. **The pole is a vertex of a loop**, where meridian or seam edges meet. In (u,v) the loop passes
   along the whole collapsed side between the two edges' pcurve ends; the side is implicit.
2. **A `vertex_loop` bound** at the pole or apex, in addition to the other bounds (a cone with a base
   circle and an apex vertex loop; Euler 2 − 1 + 4 − 3 − 2 = 0) or as the only bound of a face that
   covers the whole closed surface (a full sphere: V = 1, E = 0, F = 1, L_l = 1, S = 1, Euler
   1 − 0 + 2 − 1 − 2 = 0) [P42 5.5.14, 5.5.19].
3. **Inside the face**: a single loop wraps the period below the pole, as a hemisphere bounded only
   by its equator circle (all 12 Spatial sphere faces). In (u,v) the face is the strip between the
   loop and the collapsed side at the pole, which no edge or vertex marks.
4. **Not reached at all**: the face stays clear of the pole (split faces).

| Exporter | Sphere faces with pole as loop vertex | with vertex_loop | Cone faces with apex as loop vertex | with vertex_loop |
|---|---|---|---|---|
| SolidWorks | 132 of 150 | 0 | 2 of 233 | 0 |
| Creo | 32 of 110 | 0 | 99 of 385 | 0 |
| OpenCascade | 36 of 95 | 7 | 12 of 48 | 0 |
| Autodesk | 2 of 58 (via seams) | 0 | 0 of 5 | 0 |
| Unigraphics | 0 of 1 | 1 | 0 of 131 | 1 |
| Spatial | 0 of 12 | 0 | 0 of 65 | 0 |

[Survey; a pole or apex counts as in the loop if a loop vertex lies within min(10 × uncertainty,
1e-3 × radius) of it. The 8 sphere faces with a vertex_loop have no other bound: they are complete
spheres.] The conical apex was computed with ISO's v (section 3.5); for degree files
the semi-angle was converted.

The CAx-IF publishes no recommendation on poles (see Sources). OpenCascade translates a
vertex_loop into a wire holding one degenerate edge with no curve [OCC
StepToTopoDS_TranslateVertexLoop.cxx]; a face whose single bound is a vertex_loop on a sphere,
B-spline or revolution surface gets the surface's natural bounds instead; a vertex_loop on a torus is
skipped; on a plane it is ignored with "VertexLoop on plane is ignored" [OCC
StepToTopoDS_TranslateFace.cxx]. Shape healing then adds degenerate edges and pcurves where poles are
crossed (`FixDegeneratedMode`, `FixAddNaturalBoundMode`) [OCC resources/XSTEPResource/STEP].

What a reader must do: in (u,v), insert the collapsed side wherever a loop passes through a
degenerate point, and treat a vertex_loop at a pole as that whole side. `degenerate_pcurve` (a curve
in (u,v) that collapses to a point in space) is the standard's own representation of such a side for
surface models [P42 4.5.12]; it appeared in no surveyed file.

### 6.4 Are pcurves mandatory in AP242?

No. An `advanced_face` allows edge geometry that is a line, conic, polyline, B-spline curve or
`surface_curve` (WR3), and only when a `surface_curve` is used must its associated geometry be pcurves
(WR9) [AIC]. The AP242 schema therefore accepts B-reps with 3D curves only, and most exporters write
exactly that (fact 7). The CAx-IF's current documents contain no recommendation on writing
`surface_curve` with both representations (see Sources). OpenCascade writes pcurves only when its
`write.surfacecurve.mode` is on (unconfirmed default; the 6.8 and 7.5 files in the survey have none,
the 6.2 and 7.3 files have them). A reader must work from 3D curves alone.

### 6.5 Uncertainty in practice

The table in section 3.1 lists values from 1e-13 mm to 0.67 mm. Three consequences:

- The file's uncertainty is a claim by the exporter about its own modelling tolerance, not a
  measurement. Vertices of SolidWorks files (1e-5 mm) and OpenCascade files (1e-7 mm) are generally
  consistent with it; nothing in the survey measured that (unconfirmed).
- Very small values (1e-13 mm, Theorem) are below double precision at part scale; the decoder should
  clamp the working tolerance from below at a small multiple of the coordinate magnitude times
  machine epsilon (recommendation).
- Very large values (0.1 mm CATIA V4, 0.67 mm Pro/ENGINEER) are coarser than the chordal tolerance a
  user may ask for; the model tolerance and the meshing tolerances stay separate quantities, as the
  vocabulary already fixes.

OpenCascade uses the smallest uncertainty in the context, falls back to `read.precision.val` (1e-4
mm by default) when none is given, and caps healing tolerance at `read.maxprecision.val` (1 mm)
[OCC STEPControl_ActorRead.cxx PrepareUnits; DESTEP_Parameters.hxx].

### 6.6 Deviations an importer must survive

| Deviation | Seen in survey | OpenCascade's handling [OCC] | Recommendation for `03-step` |
|---|---|---|---|
| Vertex not on its edge's curve within tolerance | not measured | projects vertices onto the curve and enlarges the vertex tolerance ("Poor result from projection vertex / curve 3d"); for a line displaced parallel to itself (FPX Expert 2013) shifts the line through the vertices | Diagnostic with the distance; keep the vertex point as authoritative for watertightness |
| Two vertex_points at the same coordinates (duplicate vertices) | within one closed shell: 15 duplicates, 1 Creo shell of 8,363 shells; across shells and parts: 29,267 of 232,004 vertex points coincide exactly with another | merges an edge's two vertices if within 1e-7 ("Vertex of same coordinates, set confused"); merges the shared vertex of consecutive edges in a loop if within the file precision ("Adjacent edges do not have common vertex; set confused") [TranslateEdgeLoop.cxx] | Merge only within a loop's head-to-tail chain and within an edge, by tolerance, with a diagnostic; never merge across solids |
| Closed curve trimmed by two distinct vertices at one point | not measured | merges them ("Wrong topology corrected: Closed Edge with TWO different Vertices") [TranslateEdge.cxx] | Same |
| Zero-length edge (both vertices coincide, curve not closed) | none found | distinct vertices: replaces the curve by a line ("This edge has null arc length"); same vertex: drops the edge ("NULL EDGE, SKIPPED") [TranslateEdge.cxx] | Drop the edge from the loop and merge its vertices, with a diagnostic; the loop must still close |
| Face without `face_outer_bound` | 23,580 of 133,239 faces; every OpenCascade, Unigraphics, Euclid, ACIS face | treats all bounds alike; orientation fixed in healing | Determine the outer loop geometrically (largest absolute (u,v) area after unwrapping, or the loop the others lie inside) |
| Two `face_outer_bound`s on one face (face WR2) | at least 259 faces (Spatial 234, SolidWorks 25; counted on two-bound cylinder and cone faces only) | treats all bounds alike | Ignore the flag; diagnostic |
| Loop orientation inverted (bound runs the wrong way for σ(f)) | not measured | `FixOrientationMode` in healing reorients wires by geometry [XSTEPResource/STEP] | Check the left/right rule of section 4.2 per loop; if a loop fails while the face's other loops pass, reverse it with a diagnostic |
| Oriented edge nested in an oriented edge (WR1) | none | unwraps it (bug 29979) [TranslateEdgeLoop.cxx] | Same |
| B-spline end multiplicity > d+1, repeated knot values | none in 43,115 curves | clamps and drops poles; merges equal knots [StepToGeom.cxx] | Same, with a diagnostic |
| `axis` and `ref_direction` not orthogonal | none beyond 1e-9 in 188,372 placements | gp_Ax2 projects; parallel pairs fall back to its own default x | Project (ISO does), warn above an angle threshold; parallel is an error |
| Non-unit direction ratios | 25 directions in 2 files | normalizes | Normalize |
| `ref_direction` absent | 9 placements in 2 files | default x by gp_Ax2 rule, not ISO's | ISO rule (section 3.2) |
| Edge geometry is a pcurve, no 3D curve | none | builds the edge without a 3D curve, computes one later in healing (`FixAddCurve3dMode`) | Evaluate the pcurve through its surface as the edge's 3D curve (`OnSurface` with a pcurve master) |
| `curve_3d` absent (`$`) in a surface_curve | none; the attribute is not OPTIONAL, so `$` is invalid | fails the edge ("Geom Curve in EdgeCurve is equal to 0") | Fall back to the pcurve as above, with an error diagnostic |
| `degenerate_pcurve` vertex geometry | none | not read by StepToGeom (unconfirmed elsewhere) | Evaluate it as the surface point at the pcurve's start |
| Face on a closed surface with only a vertex_loop | 7 OpenCascade spheres, 1 Unigraphics sphere | natural bounds for sphere, B-spline, revolution; torus: vertex loop skipped | Whole surface; for a torus the whole torus (no seams), which the face mesher must cut twice |
| Face with no bounds at all | none; `bounds` is `SET[1:?]`, so invalid | n/a | Treat as the whole surface only if the surface is closed in both directions; else error |
| Toroidal surface with negative major radius | none | takes absolute values and inverts the face's same_sense [TranslateFace.cxx, bug 26376] | Same, with a diagnostic |
| `toroidal_surface` with major < minor (should be degenerate) | 3 faces in one Unigraphics file | reads as a self-intersecting torus | Decode; if the face's (u,v) range stays on one part, mesh it; diagnostic |
| Ellipse with semi_axis_1 < semi_axis_2 | not counted | rotates the frame by 90° | Legal; no action |
| Complex instance records out of order | 934 instances, all Spatial | (accepted; its reader keys complex instances by type set (unconfirmed)) | Match by set of names |
| Value where `*` is required (`NAMED_UNIT(#n)` beside SI_UNIT) | all Spatial files | accepted (unconfirmed) | Ignore the value |
| Lower-case schema name in FILE_SCHEMA | 17 Spatial files | accepted | Compare case-insensitively |
| Line breaks inside strings | Euclid, ST-ACIS | lexer keeps them (unconfirmed effect) | Drop them [P21 5.6] |
| Short entity names | 1 CATIA V4 file | reads them (the AP214 and AP203 readers register short names (unconfirmed)) | Map through [SN] |
| `closed_shell` with free edges inside a surface model | 371 shells, Spatial | reads as a shell; healing may fix (`FixFreeShellMode`) | Decode as open (`DeclaredClosed = true` but the closed law fails); report |
| Assembly placement items or representations swapped | not measured | detects by membership and corrects ("Axis placements are swapped in SRRWT; corrected"; CheckSRRReversesNAUO) | Decide direction by membership (section 3.8) |
| No plane-angle unit in the context | none | assumes degrees | Assume radians with a warning? The standard is silent (unconfirmed); OpenCascade's degree default is the only precedent found |
| Uncertainty in a unit other than the context's length unit | none | ignores the uncertainty's unit (uses the context's) | Convert through the uncertainty's own unit |

After translation OpenCascade runs its shape healer on every imported shape with the file's precision
as tolerance; the default operator list for STEP is `FixShape` with nearly every fix enabled
(wire order, orientation, missing seams, natural bounds, degenerate edges, small edges, gaps, same
parameter, shell and solid orientation) [OCC resources/XSTEPResource/STEP, `FromSTEP.exec.op :
FixShape`]. Much of its tolerance to bad files lives there, not in the STEP translator. The design
here keeps that split: the decoder reports and makes only the local repairs listed; validation and
any healing are later layers.

## 7. Topological validity as ISO 10303-42 states it

Formal propositions (WR) are EXPRESS rules a checker evaluates exactly; informal propositions (IP)
are the standard's prose requirements, which a checker evaluates with geometry and tolerances. In the
equations, V, E, E_l, L, L_l, F, S count distinct vertices, edges, oriented edges, loops, face bounds,
faces and shells; G a graph genus (cycle rank), H a surface genus, B the number of holes, M the
number of connected components [P42 5.1 Table 2].

| Entity | Rule | Clause |
|---|---|---|
| any graph of vertices and edges | (V − E) − (M − G) = 0 (eq. 1); a traversal algorithm computes M and G | P42 5.2.3 |
| `edge` | two vertices, possibly equal; V − 2 + G^e = 0 (eq. 2): a self-loop has G^e = 1; extent finite and non-zero (IP2) | P42 5.5.4 |
| `edge_curve` | domain is the curve between the vertices, excluding them (IP1, IP5, IP6); finite non-zero extent (IP2); a manifold (IP3); arcwise connected (IP4); vertex geometry consistent with the curve (IP7) | P42 5.5.5 |
| `oriented_edge` | WR1: the element is not an oriented_edge | P42 5.5.6 |
| `path` | WR1 head-to-tail by instance equality; dimension 1, arcwise connected, edges meet only at vertices, finite non-zero extent, no edge twice with the same orientation (IP1 to IP5); edge_list UNIQUE | P42 5.5.9 |
| `open_path` | (V − E) − 1 = 0 (eq. 3); WR1: start ≠ end | P42 5.5.12 |
| `loop` | (V − E_l) − (1 − G^l) = 0 (eq. 4); finite or zero extent; a closed curve | P42 5.5.13 |
| `vertex_loop` | V − 1 = 0; extent and dimension 0; genus 0 | P42 5.5.14 |
| `edge_loop` | WR1: first edge_start :=: last edge_end; IP1: V + G − E = 1; IP2: no edge twice with the same orientation | P42 5.5.15 |
| `poly_loop` | genus 1, V − E_l = 0; points coplanar (IP1); implicit edges do not intersect (IP2); polygon UNIQUE, ≥ 3 points | P42 5.5.16 |
| `face` | WR1: no mixing of poly_loops with other loops; WR2: at most one face_outer_bound; IP1: no edge used more than twice or twice in one direction; IP2: distinct bounds share no vertex; IP3: loops do not intersect; IP4: (V − E) − (L − Σ G^l_i) = 0 (eq. 5); IP5: loops unique; a face has no handles; bounds distinct and non-intersecting; with an outer bound, the others lie inside it and no inner loop contains another | P42 5.5.19 |
| `face_surface` | WR1: geometry not an oriented_surface; IP1 to IP8: domain is the surface inside the loops, finite non-zero, a manifold, arcwise connected, surface genus 0, loops excluded, loop geometry on the surface, loops do not intersect | P42 5.5.20 |
| `oriented_face` | WR1: element not an oriented_face | P42 5.5.21 |
| shell (select type) | connected; a 2D shell is a connected, oriented, finite, non-self-intersecting 2-manifold with boundary | P42 5.4.5 |
| `connected_face_set` | IP1: faces and bounds arcwise connected | P42 5.5.23 |
| `open_shell` | faces unique; face bounds unique; oriented edges unique; at least one edge used once, none more than twice; (V − E − L_l + 2F) − (2 − 2H − B) = 0 (eq. 7), B the genus of the graph of once-used edges; necessary condition V − E − L_l + B even and ≤ 2 − 2F (eq. 8); the domain is orientable | P42 5.5.26 |
| `closed_shell` | eq. 7 with B = 0: V − E − L_l + 2F = 2 − 2H; necessary condition V − E − L_l even and ≤ 2 − 2F (eq. 9); IP1: every edge referenced exactly twice by the face bounds; IP2: oriented edges unique; IP3: no edge in more than two faces; IP4, IP5: faces and edges meet only at shared edges and vertices; IP6: faces unique; IP7: no poly_loop mixing; IP8: an oriented arcwise-connected manifold; IP9: Euler; IP10: every face normal (after orientation) points from the finite region outward | P42 5.5.28 |
| `oriented_closed_shell` | WR1: element not oriented | P42 5.5.29 |
| `manifold_solid_brep` | χ = V − E + 2F − L_l − 2(S − G^s) = 0 (eq. 1 of clause 6), G^s the summed shell genus; shells, faces, loops and (edge, sense) pairs unique; every edge used by exactly two loops or twice by one; IP1: dimension 3; IP2: finite non-zero extent; IP3: no two vertex_points, undirected edge_curves or face_surfaces intersect; IP4: distinct loops of a face share no vertex; IP5: all topology has geometry; IP6: shell normals point away from the solid; IP7: each face in one shell once; IP8: each oriented edge once; IP9: each edge exactly twice; IP10: Euler; IP11: no poly_loops unless faceted; IP12: a faceted_brep uses only poly_loops | P42 6.4.2 |
| `brep_with_voids` | IP1: void shells disjoint from the outer and each other; IP2: each void inside the outer and not inside another void; IP3: each shell referenced once; voids have orientation FALSE (advanced_brep WR5) | P42 6.4.3 |
| `faceted_brep` | IP1: all bounds poly_loops; IP2: explicit face surfaces are planes containing the loops | P42 6.4.4 |
| `shell_based_surface_model` | WR1: shells are open or closed; IP1: dimension 2; IP2: shells meet only at shared faces, edges, vertices | P42 6.4.44 |
| `topological_representation_item` | IP1: no two distinct edges, edge_curves or face_surfaces reachable from one item have intersecting domains | P42 5.5.1 |

Checks against the survey [Survey]: of 8,363 closed shells, 8,005 satisfy eq. 7 with integer H ≥ 0
(7,346 of genus 0, 592 of genus 1, 29 of genus 2, 11 of genus 3, 27 of genus 4 or more); every shell
of a solid has every edge used exactly twice; all 358 failures are `closed_shell`s inside surface
models, mostly Spatial's, that have edges used once. For the validation layer this means: the Euler
check and the edge-use check are cheap, exact, and almost always pass on solids, so a failure is
informative.

What the standard does not state, and a validator has to add with tolerances: that a vertex point
lies on its edge's curve (only "consistent", edge_curve IP7), that edge curves lie on the face
surfaces (face_surface IP7), that loops do not intersect in (u,v) (IP3), and that the shell's faces
do not intersect (IP4). These are the geometric laws of `02-topology` (`Law_VertexCoincidesWithCurveEnd`,
`Law_EdgeLiesOnAdjacentSurfaces`, `Law_PcurveAgreesWithCurve`), each with the file's length tolerance.

## 8. Test files

### 8.1 Public sources

| Source | What it holds | What it exercises |
|---|---|---|
| NIST MBE PMI test cases: download page <https://www.nist.gov/ctl/smart-connected-systems-division/smart-connected-manufacturing-systems-group/mbe-pmi-0>, STEP files <https://www.nist.gov/document/nist-pmi-step-files>; CAx-IF mirror <https://www.mbx-if.org/home/?p=1310> | Combined test cases CTC-01 to CTC-05, fully toleranced FTC-06 to FTC-11, simplified STC; AP203 and AP242 exports from CATIA, NX, Creo, SolidWorks, Inventor; CTC-02 and CTC-04 form an assembly | Machined prismatic parts: cylinders, cones, tori, B-spline blends, holes (genus > 0); the same geometry from five exporters, so convention differences show directly; validation properties where present (described from NIST's pages; not surveyed here) |
| NIST STEP File Analyzer and Viewer <https://www.nist.gov/services-resources/software/step-file-analyzer-and-viewer>, source <https://github.com/usnistgov/SFA> | A checker: syntax and EXPRESS rule checks, validation property reports, a viewer | An independent oracle for `07-validation` (whether its repository ships sample files is unconfirmed) |
| STEP Tools sample AP203 files <https://www.steptools.com/docs/stpfiles/ap203/> | About 55 files from ACIS, Pro/E, CATIA V4, CADDS, Unigraphics, 1998 to 2002 | `block.stp` (ACIS, 6 planar faces, `intersection_curve` on bare planes, degrees, placements without ref_direction): starter; `moon_buggy_asm.stp` (Unigraphics 10.5: vertex loops on a sphere, a torus and a cone, mapped-item assembly, extrusion, B-spline faces, inch and degree, a torus with major < minor); `as1_pe.stp` (Pro/E: context-dependent assembly, inch, degree, per-part uncertainty); `turbine.stp` (Unigraphics 13: 1,241 faces, cones with semi-angle `45.` in degrees, no seams); `bull.stp` (CADDS: quasi-uniform and rational B-spline faces); `clip.stp` (CATIA V4: short names, faceted B-rep with poly loops); `cubcylso.stp` (CATIA V4: 0.1 mm uncertainty) |
| STEP Tools sample AP214 files <https://www.steptools.com/docs/stpfiles/ap214/> | `as1-*-214`, `io1-*-214`, `d2`, `f1`, `boxy_*` | `as1-ec-214.stp` (CAS.CADE: every edge a surface curve with two pcurves, master `PCURVE_S2`); `io1-tc-214.stp` (Theorem: surfaces of revolution, uncertainty 1e-13 mm, non-unit directions); `io1-ca-214.stp` (CADDS: B-spline faces); `as1-ug-214.stp` (Unigraphics 16: assembly, degree) |
| OpenCascade data <https://github.com/Open-Cascade-SAS/OCCT/tree/master/data/step> | `screw.step`, `linkrods.step` (Euclid) | Seam curves with two pcurves, tori, cones with seams, rational B-spline faces, line breaks inside strings |
| u-blox 3D-Step-Models-Library <https://github.com/u-blox/3D-Step-Models-Library> | 88 module models, AP203 and AP214 | Exporter variety (SolidWorks 2011 to 2024, OpenCascade 6.2 to 7.6, Spatial, Creo 2022, Autodesk); assemblies with up to 1,218 occurrences; the deviations of section 6.6 |
| NASA 3D Resources <https://github.com/nasa/NASA-3D-Resources> | `rassor_shrinkwrap.stp` (Creo, 44 MB) | 13,394 faces, two `brep_with_voids`, 94 extrusion faces, 1,208 B-spline faces, degree units: a size and void test |
| ABC dataset <https://deep-geometry.github.io/abc-dataset/> (Koch et al., CVPR 2019) | About one million Onshape models exported as STEP | Volume and B-spline-heavy geometry for property-based and fuzz testing (exporter is single, Parasolid via Onshape (unconfirmed)) |
| Fusion 360 Gallery <https://github.com/AutodeskAILab/Fusion360GalleryDataset> | Autodesk designs with STEP exports (unconfirmed which subsets include STEP) | Sketch-and-extrude solids, simple assemblies |
| CAx-IF test rounds <https://www.mbx-if.org/home/cax/> | Round test files and statistics | Restricted to members; listed for completeness |

### 8.2 Files already on this machine

The survey files (section 6.1) are on disk and cover most conventions; a first conformance corpus can
be drawn from them without downloading anything. Paths under
`C:\Users\cdigg\git\3d-format-shootout\data\submodules\` (u-blox and NASA); the STEP Tools and
OpenCascade samples were downloaded to the session scratchpad and would have to be fetched again.

| File | Exporter | Exercises |
|---|---|---|
| `3D-Step-Models-Library/SHO/NORA-B101.step` | OpenCascade 6.8 | 117 seam loops (cylinders), B-spline faces, assembly |
| `3D-Step-Models-Library/SHO/IRIS-W1x1.step` | OpenCascade 6.8 | 2 sphere faces bounded by a vertex loop at the pole; seams |
| `3D-Step-Models-Library/SHO/ELLA-W1.STEP` | OpenCascade 6.2 | 8,386 pcurves, master `PCURVE_S1` |
| `3D-Step-Models-Library/SHO/NINA-B222-W1x2.STEP` | FreeCAD (OpenCascade 7.3) | pcurves and a `seam_curve` |
| `3D-Step-Models-Library/SHO/c211_case_with_odin_v1.step` | Autodesk | 44 seams on cylinders, cones, spheres, tori; no pcurves |
| `3D-Step-Models-Library/SHO/ODIN-W260.STEP` | Spatial | `brep_with_voids`; 72 cylinder bands each with two outer bounds; a sphere face whose pole lies inside a single wrapping loop; out-of-order complex units; metre units, 1e-6 m uncertainty |
| `3D-Step-Models-Library/SHO/THEO-P173.STEP` | Spatial | 366 surface models whose `closed_shell`s have free edges |
| `3D-Step-Models-Library/POS/ANN-MB2.step` | SolidWorks 2016 | `brep_with_voids` |
| `3D-Step-Models-Library/SHO/BMD-301.STEP` | SolidWorks 2017 | lines with \|V\| = 1000, split periodic faces |
| `3D-Step-Models-Library/SHO/JODY-W3.STEP` | SolidWorks 2017 | 24 sphere faces whose pole is a loop vertex; 16 surface models |
| `3D-Step-Models-Library/CEL/LENA-R8.STEP` | Creo 2022 | degree units, lines parameterized 0 to 1, 261 extrusion faces |
| `3D-Step-Models-Library/SHO/M2-JODY-W377-00C_PCIE-UART.step` | FreeCAD | 1,218 assembly occurrences, 1,071 surface models |
| `NASA-3D-Resources/3D Models/Regolith Advanced Surface Systems Operations Robot (RASSOR)/rassor_shrinkwrap.stp` | Creo | size, voids, degrees |

### 8.3 Synthetic witnesses

The vocabulary's witnesses (`Witness_UnitBox`, `Witness_Cylinder`, `Witness_Sphere`, `Witness_Torus`,
`Witness_Cone`, `Witness_BlockWithThroughHole`, `Witness_HollowBox`, `Witness_BSplinePatchSolid`)
should each exist in several STEP encodings, because the conventions above multiply: a cylinder with
a seam, as a band, and split in two; a sphere with poles as loop vertices, with two vertex loops,
with a single vertex loop, and as a hemisphere pair bounded by an equator; each in radians and in
degrees; each with and without pcurves. Section 4.3 gives the instance list of one of them. Small
hand-written files of this kind are the cheapest way to test the decoder's handling of every flag
combination, and they double as regression tests for the deviations of section 6.6.

## 9. Consequences for the vocabulary, and open questions

Points where the material above presses on a fixed or proposed name in
[../VOCABULARY.md](../VOCABULARY.md). None is a change; each is for the owning layer to decide and
record.

1. **`Periodicity` and closed-but-bounded directions** (`00-foundation`). A clamped B-spline surface
   closed in u, a `degenerate_toroidal_surface`'s v, and a sphere's v are bounded; cylinders and tori
   are periodic. A face on a closed clamped B-spline still has a seam whose two pcurves sit at the
   two ends of the domain. `Periodic(Period)` covers the angular cases; the B-spline case needs either
   "closed" as a separate notion or the decoder converting such surfaces to a periodic form, as
   OpenCascade does.
2. **`Torus` payload** (`01-geometry`). It must carry select_outer (or an equivalent v range) for
   `degenerate_toroidal_surface`, and must accept major < minor from plain `toroidal_surface`.
3. **`Cone` parameter** (`01-geometry`). ISO's v is axial (section 3.5). Any conversion to a
   slant-length form, or to the stdlib's unit-square cone, is a `To*` function.
4. **`Line` and `LinearExtrusion` payloads** (`01-geometry`). Keep the vector with its magnitude;
   exporters use magnitudes 1, edge length, and 1000.
5. **`BrepEdge` has no parameter interval** (`02-topology`). The interval is derived by
   `EdgeDomain(m, e)` from vertex projection (section 4.1). The decoder may cache it in a side table
   keyed by `BrepEdgeIndex`; whether the cache belongs in `BrepModel` is open.
6. **`FaceBound.IsOuter` is a hint** (`02-topology`). It is absent from a sixth of faces and doubled on
   some (section 6.6); laws should not rely on it.
7. **`BrepShell.DeclaredClosed`** (`02-topology`). Confirmed necessary: 371 `closed_shell`s in the
   survey are not closed.
8. **Pcurves per coedge, not per edge** (`02-topology`, `03-step`). A seam edge has two pcurves on
   one face; an ordinary edge has up to one per adjacent face. The vocabulary's `BrepEdgeUse` (stdlib)
   has no pcurve field and `BrepEdge` has none either. Where the pcurve of a use is stored is open; the
   decoder can only fill it for the minority of files that carry pcurves.
9. **One unit and one tolerance per `BrepModel`** (`03-step`, `08-pipeline`). Assemblies can mix
   contexts. Decode per representation context and convert, or one model per context: open.
10. **Angle conversion happens once** (`03-step`). Every angle in the kernel is radians; the
    decoder's unit factors are the only place degrees exist.

Open questions found while writing:

- Do exporters that assign degrees write pcurve u coordinates in degrees? No surveyed file combines
  the two (section 5.1). OpenCascade assumes yes.
- Which plane-angle unit applies when a context lists none? The standard is silent as far as read;
  OpenCascade assumes degrees.
- Does any exporter write `seam_edge`, `degenerate_pcurve`, or a `cartesian_transformation_operator_3d`
  placement? None appears in the survey; the NIST and CAx-IF files were not surveyed.
- The P42 2021 copy read has typographical errors in the ellipse formula, the surface normal
  definition, the cone attribute list, and the implied knot counts of `quasi_uniform_curve` and
  `bezier_curve` (sections 3.3, 3.5, 5.3); the corrections here follow the implicit equations and
  the function definitions, and should be checked against a printed edition if one is available.
- EXPRESS clause numbers of ISO 10303-11 are given from memory.
