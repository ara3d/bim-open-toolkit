# What "AEC world model" suggests to different audiences

The phrase collides two terms that already mean different things to different
people. This note maps out those meanings so the term is used deliberately —
and so a description of this toolkit's approach doesn't accidentally overclaim
or undersell.

## The core ambiguity

"World model" is a term of art in AI: a *learned, predictive* model of
environment dynamics — something you roll forward, query counterfactually, and
use for planning (Ha & Schmidhuber, LeCun's JEPA program, DeepMind's Genie,
NVIDIA Cosmos, driving world models like GAIA). In AEC, "model" already means
BIM: an *authored, explicit, semantic* database. So "AEC world model" reads as
either "a learned simulator of the built world" or "BIM, but finally
complete," depending on who's listening — and those are close to opposite
artifacts. One is statistical and predictive; the other is declarative and
auditable.

## What each audience hears

**AI/ML researchers** hear a foundation model trained on built-environment
data (IFC, point clouds, drawings, site imagery). They'd expect: given a
partial observation, predict the rest; simulate physical or construction
dynamics forward; support planning agents. They'd judge it on predictive
accuracy and generalization to unseen buildings, and assume it's learned,
latent, and probabilistic. The benefit story is that it becomes the backbone
for downstream agents — design assistants, construction robots, automated
estimators.

**Architects and engineers (BIM practitioners)** hear "super-BIM": one
unified, semantically complete representation of the built world that
transcends any single authoring tool — geometry plus semantics plus
relationships, spanning building, site, and city (BIM+GIS merged), with no
format wars. They'd expect to query it in plain language and get automatic
code checking, quantity takeoff, and design validation "for free." The
benefit is a single source of truth and the end of rework caused by lossy
exchange. They'd expect it to be *correct by construction*, not statistically
plausible.

**Contractors and construction managers** hear something that understands
*messy reality* rather than design intent: as-built vs. as-designed
reconciliation, progress inferred from photos and scans, 4D/5D awareness,
site logistics. Their test is whether it knows what's actually on site today.
Benefits: schedule and cost prediction, risk surfacing, clash detection
against reality rather than against another model.

**Owners and facility managers** hear "digital twin" — a live,
sensor-connected replica for operations. Expectations: real-time state,
predictive maintenance, energy scenario simulation, space management. Most
won't distinguish "world model" from the twin vocabulary they already have;
the term just sounds like the AI-era version of it.

**Regulators, code officials, and standards bodies** hear something quite
specific: a formalization of the built world precise enough that rules become
*computable*. A shared ontology where "door," "clearance," and "egress path"
have defined, machine-checkable meanings. Their expectations run opposite to
the ML researcher's: determinism, provenance, auditability, and a clear
account of what the model does and doesn't represent. A black-box predictor
is close to worthless to them; a transparent semantic model with known
coverage is valuable.

**Robotics people** hear a spatial-dynamical model for navigation and
manipulation on construction sites: occupancy, affordances, physics, change
over time. This is the most literal reading of "world model" and the least
served by anything AEC currently has.

**Executives and investors** hear "the GPT of buildings" — a platform-scale
pretrained asset that others build on, with the moat coming from proprietary
training data. They'll judge it by demos and by the analogy to language
models, and expect the pitch to include an API and an ecosystem.

## What's common, and where the tension bites

Across all of these, three expectations are shared: **completeness**
(geometry + semantics + physics + process, not just shapes), **queryability**
(ask arbitrary questions about the built environment and get grounded
answers), and **grounding** (it corresponds to physical reality, not merely
to documents).

The tension that matters for how this repo talks about itself: the AI
connotation of "world model" promises *learned and generative*, while the
problems this toolkit actually serves — compliance, validation, ground
truth — need *explicit and verifiable*. Using "AEC world model" loosely risks
two failure modes at once: ML-adjacent readers expect a trained simulator and
may see the term as overclaimed, while regulators may be wary of an implied
statistical inference where they need determinism.

The framing that threads the needle is to be explicit about the hybrid: a
symbolic/semantic world model (the auditable substrate — BOS, IFC, converted
data) that LLMs *interface with*, rather than a world model that *is* a
neural network. That is the honest description of a code-to-rule-to-checker
architecture: the LLM translates and orchestrates, but the model itself stays
deterministic and inspectable. See the [nrc-ifc-llm](https://github.com/ara3d/nrc-ifc-llm)
door-clearance demonstration for a worked example of this pattern.
