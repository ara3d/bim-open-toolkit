using BimOpenFlow.Host;
using BimOpenFlow.Studio;

// The DuckDB workflow studio's host: the whole bimopenflow-host API plus
// POST /api/ask, which builds a graph from a plain-language request through the
// MCP tools. Same options as bimopenflow-host; the OpenAI key comes from
// OPENAI_API_KEY or OPENAI_API_KEY_FILE, the model from OPENAI_MODEL.
return await HostRunner.RunAsync(args, host => host.App.MapAsk(host.Services), "BimOpenFlow studio");
