using System.Collections.Concurrent;
using BimOpenFlow.Ask;
using BimOpenMcp.Flow;

namespace BimOpenFlow.Studio;

/// <summary>Runs one POST /api/ask request over an IAskBackend: picks or continues the
/// conversation for the analysis id, reports the agent's events, then runs the host's own
/// check rounds before the 'done' event. Kept out of the endpoint lambda so it can be tested
/// without Kestrel. The caller starts the SSE response and holds the one-at-a-time gate.</summary>
public sealed class AskHandler(FlowServices services, IAskBackend backend, Func<string> system, string model, string? effort = null)
{
    /// <summary>How many conversations (by analysis id) this handler remembers before the
    /// oldest is dropped; a follow-up on a dropped id still works if the graph itself exists,
    /// but starts a fresh conversation (see AskPrompts.FollowUp's 'resumed' flag).</summary>
    public const int ConversationsKept = 24;
    public const int CheckRounds = 2;

    private readonly ConcurrentDictionary<string, IAskConversation> _conversations = new(StringComparer.Ordinal);
    private readonly ConcurrentQueue<string> _recent = new();

    /// <summary>One request: empty-request error, pick or continue the conversation, start, tool
    /// and text events, the host's check rounds, done; any failure but cancellation becomes the
    /// error event.</summary>
    public async Task RunAsync(AskRequest body, Func<object, Task> emit, CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(body.Request))
            {
                await emit(new { type = "error", message = "Type a request first." });
                return;
            }

            // A follow-up continues a conversation this handler remembers (even one that
            // only asked a question back) or, after a restart, a graph that exists.
            var requested = body.AnalysisId?.Trim();
            var known = requested is { Length: > 0 } && _conversations.TryGetValue(requested, out var remembered)
                ? remembered
                : null;
            var continuing = known is not null || (requested is { Length: > 0 } && services.Host.Store.Exists(requested));
            var id = continuing ? requested! : AskIds.For(body.Request, services.Host.Store.Exists);
            var conversation = known ?? Remember(id, backend.Start(system()));
            var user = continuing
                ? AskPrompts.FollowUp(body.Request, id, resumed: known is null)
                : AskPrompts.User(body.Request, id);
            await emit(new { type = "start", analysisId = id, model, effort, continuing });

            Task Report(AskEvent e)
                => emit(new { type = e.Type, name = e.Name, args = e.Args, ok = e.Ok, summary = e.Summary, text = e.Text });
            var outcome = await conversation.SendAsync(user, Report, ct);

            // The host's own check: the agent gets up to two more turns to fix or
            // explain a graph that does not evaluate or answers with no rows.
            var problem = AskChecks.Verify(services, id);
            for (var round = 0; problem is not null && round < CheckRounds; round++)
            {
                await emit(new { type = "check", ok = false, summary = problem });
                var retry = await conversation.SendAsync(AskPrompts.Check(problem), Report, ct);
                outcome = new AskOutcome(retry.Text, outcome.Turns + retry.Turns,
                    outcome.InputTokens + retry.InputTokens, outcome.OutputTokens + retry.OutputTokens);
                problem = AskChecks.Verify(services, id);
            }
            await emit(new
            {
                type = "done",
                analysisId = id,
                built = services.Host.Store.Exists(id),
                verified = services.Host.Store.Exists(id) && problem is null,
                problem,
                text = outcome.Text,
                turns = outcome.Turns,
                inputTokens = outcome.InputTokens,
                outputTokens = outcome.OutputTokens,
                model,
                effort,
            });
        }
        catch (OperationCanceledException)
        {
            // The browser went away; nothing to tell it.
        }
        catch (Exception e)
        {
            await emit(new { type = "error", message = e.Message });
        }
    }

    private IAskConversation Remember(string id, IAskConversation conversation)
    {
        _conversations[id] = conversation;
        _recent.Enqueue(id);
        while (_recent.Count > ConversationsKept && _recent.TryDequeue(out var old))
            _conversations.TryRemove(old, out _);
        return conversation;
    }
}
