using System;
using System.Collections.Generic;
using System.Linq;

namespace Ara3D.NodeGraph;

/// <summary>
/// Undo/redo as an immutable snapshot stack of documents (deliberately simple:
/// documents are small and immutable, so full snapshots beat operation diffs).
/// Applying a new document clears the redo stack. Undo/Redo at the end of the
/// stack are no-ops.
/// </summary>
public sealed record GraphHistory(
    GraphDocument Current,
    IReadOnlyList<GraphDocument> UndoStack,
    IReadOnlyList<GraphDocument> RedoStack)
{
    public static GraphHistory Start(GraphDocument doc)
        => new(doc, Array.Empty<GraphDocument>(), Array.Empty<GraphDocument>());

    public bool CanUndo
        => UndoStack.Count > 0;

    public bool CanRedo
        => RedoStack.Count > 0;

    public GraphHistory Apply(GraphDocument next)
        => new(next, UndoStack.Append(Current).ToList(), Array.Empty<GraphDocument>());

    public GraphHistory Undo()
        => CanUndo
            ? new(UndoStack[^1], UndoStack.Take(UndoStack.Count - 1).ToList(), RedoStack.Append(Current).ToList())
            : this;

    public GraphHistory Redo()
        => CanRedo
            ? new(RedoStack[^1], UndoStack.Append(Current).ToList(), RedoStack.Take(RedoStack.Count - 1).ToList())
            : this;
}
