# Bounded assistant review tools

`createReviewTools(host, {allowWrites})` provides `list()` descriptors and asynchronous `call(name, arguments)` results. It has no renderer, transport, filesystem, network or evaluation dependency. Descriptors expose `name`, `description`, `inputSchema` and a read-only annotation. Results use MCP-compatible text content and `isError`, matching the repository's existing `platoflow/host/McpEndpoint.cs` pattern.

The registry defaults to read-only; those hosts expose `list_models`, `list_objects` and `scene_state`. Explicit `allowWrites: true` adds `select`, camera-changing `fit`, `set_style` and `reset_style`. A host injects current models/selection and the three typed command callbacks. It should implement style changes in a reversible override layer; `reset_style` removes those overrides to restore host base appearance. Authoritative model records remain outside tool mutation.

```ts
const tools = createReviewTools({
  snapshot: () => ({ models: loadedModels, selection: selection.snapshot() }),
  select: refs => { selection.replace(refs); },
  fit: refs => refs === null ? fitAll() : fitObjects(refs),
  setStyle: (refs, style) => updateReviewOverrides(refs, style),
}, { allowWrites: true });
const result = await tools.call('select', {
  refs: [{ modelId: 'snowdon', objectId: 'bos:1', revision: actualSourceHash }],
});
```

Every explicit reference carries model ID, object ID and revision. The registry checks the current revision and every object before invoking a command; unknown models, absent objects and stale revisions return diagnostics, with no partial callback. Duplicate refs are deduplicated. Fit uses explicit nonempty refs or `all: true`; selection can be cleared with an empty ref array. Set-style accepts only finite RGB values in [0,1] and/or boolean visibility. Host command failures become bounded error results. If a host defers mutations asynchronously, it must retain or revalidate the corresponding snapshot itself.

Queries page with offset/limit (default 25, maximum 100); object pages omit geometry and transforms and truncate display names to 128 characters. Scene state returns aggregate counts and at most 100 selected refs. Mutation batches contain at most 100 refs. Requests are capped at 8,192 JSON characters and responses at 32,768 text characters; oversized results ask for a smaller page. These are character caps, not byte measurements. Unexpected fields, unknown tools and invalid types/ranges are rejected. No prompt text is evaluated or turned into an arbitrary operation.

`assistantDemo` runs visible JSON requests in process, displays each result and marks scene-changing tool choices. It explicitly enables writes, routes selection through SelectionStore, composes reversible appearance overrides, and fits the world bounds of requested source representations. Selection highlight takes precedence over style color. There is no LLM connection or external MCP endpoint in this demo.

An actual MCP host still needs transport, protocol negotiation, lifecycle, authentication and authorization appropriate to its deployment. The registry is an integration seam, not a deployed MCP server or protocol conformance claim. No external transport was added in this track.

## Track checkpoint

- State: verified, V1/G1.1 unchanged; four owned files: `src/review-tools.ts`, `test/review-tools.test.ts`, `examples/features/assistant.ts`, this document.
- Direct Vitest `run test/review-tools.test.ts --maxWorkers=1 --cache=false`: 5/5 passed. Covers paging/read-only defaults, complete-batch and revision validation, deduplication, scoped fit, reversible style dispatch, immutable source data, malformed/oversized requests, capped host responses and host errors.
- Strict `tsc --noEmit` passed for registry and demo with exact optional properties and unchecked indexes.
- No builds, installs, generated output, external service calls or running processes. Coordinator owns public exports, gallery registration and browser verification. Commit turn requested; hash reported after commit.
