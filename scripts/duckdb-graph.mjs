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
      if (!graph.structure.edges.some(edge => edge.to === node.id + '.source'))
        graph.structure.edges.push({ from: source + '.source', to: node.id + '.source' });
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
