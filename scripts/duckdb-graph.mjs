/** Upgrade the demo wiring without replacing user SQL, filters, limits or paths. */
export function upgradeDuckDbGraph(document) {
  const graph = structuredClone(document);
  const sources = new Map();
  for (const node of graph.structure.nodes)
    if (node.kind === 'duck.source') sources.set(graph.values[node.id]?.path, node.id);
  for (const node of [...graph.structure.nodes]) {
    const values = graph.values[node.id] ??= {};
    if (node.kind === 'duck.query' && values.path) {
      let source = sources.get(values.path);
      if (!source) {
        source = 'database';
        for (let n = 2; graph.structure.nodes.some(node => node.id === source); n++) source = 'database-' + n;
        graph.structure.nodes.push({ id: source, kind: 'duck.source', version: 1 });
        graph.values[source] = { path: values.path };
        sources.set(values.path, source);
      }
      if (!graph.structure.edges.some(edge => edge.to === node.id + '.path'))
        graph.structure.edges.push({ from: source + '.source', to: node.id + '.path' });
      delete values.path;
    }
    if (node.kind === 'table.sort' && values.by && !values.A && !values.B && !values.C) {
      const terms = values.by.split(',').map(term => term.trim());
      if (terms.length <= 3) {
        for (const [index, term] of terms.entries()) {
          const key = ['A', 'B', 'C'][index];
          values[key] = term.replace(/\s+(asc|desc)$/i, '');
          values['descending' + key] = String(/\s+desc$/i.test(term));
        }
        delete values.by;
      }
    }
  }
  return graph;
}

/** A copy of the graph with the placeholder replaced by target (forward slashes) in every
 * parameter value and every graph input default, as the host's SampleSeeding.RewritePaths does. */
export function rewritePlaceholder(document, placeholder, target) {
  const graph = structuredClone(document);
  const path = target.replaceAll('\\', '/');
  for (const values of Object.values(graph.values ?? {}))
    for (const [name, value] of Object.entries(values))
      if (typeof value === 'string') values[name] = value.replaceAll(placeholder, path);
  for (const input of graph.structure?.inputs ?? [])
    if (typeof input.default === 'string') input.default = input.default.replaceAll(placeholder, path);
  return graph;
}
