namespace AppName.Domain.Querying;

/// <summary>
/// The contract a filter type implements to nest inside itself. One node carries its own
/// leaf values, the operator that joins them, and its child nodes of the same type. The
/// self-referencing type parameter keeps the tree homogeneous, so a node can hold only
/// nodes of its own aggregate.
/// </summary>
/// <typeparam name="TSelf">The implementing filter type.</typeparam>
public interface IFilterNode<out TSelf> where TSelf : IFilterNode<TSelf>
{
    /// <summary>
    /// Operator joining the leaves of this node and its child nodes.
    /// </summary>
    LogicalOperator Operator { get; }

    /// <summary>
    /// Child nodes of this node. Empty for a flat filter.
    /// </summary>
    IReadOnlyList<TSelf> Groups { get; }
}
