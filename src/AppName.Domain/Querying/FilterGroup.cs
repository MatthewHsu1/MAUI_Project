using System.Linq.Expressions;

namespace AppName.Domain.Querying;

/// <summary>
/// One node of a filter tree: the typed predicates it holds, its child nodes, and the
/// operator that joins them all. <see cref="ToExpression"/> folds the node and every
/// descendant into a single predicate.
/// </summary>
/// <typeparam name="TEntity">Entity the predicates test.</typeparam>
/// <param name="op">Operator joining the leaves and the child groups.</param>
/// <param name="leaves">Predicates this node holds directly.</param>
/// <param name="groups">Child nodes of this node.</param>
public sealed class FilterGroup<TEntity>(
    LogicalOperator op,
    IReadOnlyList<Expression<Func<TEntity, bool>>> leaves,
    IReadOnlyList<FilterGroup<TEntity>> groups)
{
    /// <summary>
    /// Operator joining the leaves and the child groups of this node.
    /// </summary>
    public LogicalOperator Operator { get; } = op;

    /// <summary>
    /// Predicates this node holds directly.
    /// </summary>
    public IReadOnlyList<Expression<Func<TEntity, bool>>> Leaves { get; } = leaves;

    /// <summary>
    /// Child nodes of this node.
    /// </summary>
    public IReadOnlyList<FilterGroup<TEntity>> Groups { get; } = groups;

    /// <summary>
    /// True when this node and every descendant carry no leaf. A node that holds only empty
    /// child groups is empty, so the test recurses instead of counting the child list.
    /// </summary>
    public bool IsEmpty => Leaves.Count == 0 && Groups.All(g => g.IsEmpty);

    /// <summary>
    /// Folds this node and every descendant into one predicate, or returns <c>null</c> when
    /// the node carries no leaf at any depth.
    /// <para>
    /// The <c>null</c> result applies to <see cref="LogicalOperator.Or"/> as well as to
    /// <see cref="LogicalOperator.And"/>. In strict boolean algebra an empty <c>Or</c> is
    /// match-none, but a filter that the user left blank must never hide every row. Every
    /// caller therefore reads <c>null</c> as "no restriction" and applies no <c>WHERE</c>.
    /// Returning <c>null</c> also removes the need for a false-predicate sentinel that a
    /// later stage would have to detect.
    /// </para>
    /// </summary>
    /// <returns>The folded predicate, or <c>null</c> when the subtree is empty.</returns>
    public Expression<Func<TEntity, bool>>? ToExpression()
    {
        if (IsEmpty)
        {
            return null;
        }

        Expression<Func<TEntity, bool>>? folded = null;

        foreach (var leaf in Leaves)
        {
            folded = folded is null ? leaf : Join(folded, leaf);
        }

        foreach (var group in Groups)
        {
            var child = group.ToExpression();

            // An empty child restricts nothing, so it must not become a false arm of an Or
            // or a redundant true arm of an And. Skipping it keeps the tree free of both.
            if (child is null)
            {
                continue;
            }

            folded = folded is null ? child : Join(folded, child);
        }

        return folded;
    }

    private Expression<Func<TEntity, bool>> Join(
        Expression<Func<TEntity, bool>> left,
        Expression<Func<TEntity, bool>> right)
        => Operator == LogicalOperator.And ? left.AndAlso(right) : left.OrElse(right);
}
