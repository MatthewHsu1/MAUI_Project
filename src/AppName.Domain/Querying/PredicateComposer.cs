using System.Linq.Expressions;

namespace AppName.Domain.Querying;

/// <summary>
/// Joins two typed predicates into one lambda that keeps a single parameter. The right
/// lambda's parameter is rebound to the left lambda's parameter with an
/// <see cref="ExpressionVisitor"/>, so the result is a plain binary expression over one
/// parameter and every LINQ provider translates it.
/// <para>
/// The obvious alternative, <see cref="Expression.Invoke(Expression, Expression[])"/> (the
/// mechanism behind LinqKit's <c>PredicateBuilder</c>), is rejected on purpose. EF Core
/// translates an invocation node only when the query also calls <c>AsExpandable()</c>. One
/// forgotten call does not fail: the query silently falls back to client-side evaluation,
/// pulls the whole table, and no type or compiler check catches it. Rebinding the parameter
/// costs about thirty lines and removes both the dependency and that trap.
/// </para>
/// </summary>
public static class PredicateComposer
{
    /// <summary>
    /// Returns a predicate that matches when both <paramref name="left"/> and
    /// <paramref name="right"/> match.
    /// </summary>
    /// <typeparam name="T">Entity the predicates test.</typeparam>
    /// <param name="left">Left predicate. Its parameter becomes the result's parameter.</param>
    /// <param name="right">Right predicate. Its parameter is rebound to the left one.</param>
    /// <returns>One lambda with exactly one parameter.</returns>
    public static Expression<Func<T, bool>> AndAlso<T>(
        this Expression<Func<T, bool>> left,
        Expression<Func<T, bool>> right)
        => Compose(left, right, Expression.AndAlso);

    /// <summary>
    /// Returns a predicate that matches when <paramref name="left"/> or
    /// <paramref name="right"/> matches.
    /// </summary>
    /// <typeparam name="T">Entity the predicates test.</typeparam>
    /// <param name="left">Left predicate. Its parameter becomes the result's parameter.</param>
    /// <param name="right">Right predicate. Its parameter is rebound to the left one.</param>
    /// <returns>One lambda with exactly one parameter.</returns>
    public static Expression<Func<T, bool>> OrElse<T>(
        this Expression<Func<T, bool>> left,
        Expression<Func<T, bool>> right)
        => Compose(left, right, Expression.OrElse);

    private static Expression<Func<T, bool>> Compose<T>(
        Expression<Func<T, bool>> left,
        Expression<Func<T, bool>> right,
        Func<Expression, Expression, BinaryExpression> join)
    {
        var parameter = left.Parameters[0];

        // Visit the right BODY, not the right lambda: a rewritten lambda would still declare
        // its own parameter, and the join would then hold two unrelated parameters.
        var reboundRight = new ParameterReplacer(right.Parameters[0], parameter).Visit(right.Body);

        return Expression.Lambda<Func<T, bool>>(join(left.Body, reboundRight), parameter);
    }

    /// <summary>
    /// Replaces every occurrence of one parameter node with another.
    /// </summary>
    private sealed class ParameterReplacer(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
    {
        /// <inheritdoc/>
        protected override Expression VisitParameter(ParameterExpression node)
            // Parameter identity is reference identity. Two parameters of the same name and
            // type are still different nodes, so comparing names would rebind the wrong one.
            => ReferenceEquals(node, from) ? to : node;
    }
}
