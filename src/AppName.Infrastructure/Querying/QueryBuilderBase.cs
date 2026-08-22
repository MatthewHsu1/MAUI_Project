using System.Linq.Expressions;
using AppName.Domain.Querying;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Querying;

/// <summary>
/// Fluent builder that turns a filter tree, a sort, and a window into one
/// <see cref="IQueryable{T}"/>. The base owns the recursion, the AND/OR composition, the
/// tie-break rule, and paging. Each aggregate supplies only <see cref="BuildLeaves"/>,
/// <see cref="ApplySort"/>, and <see cref="ApplyTieBreak"/>.
/// <para>
/// This is a class holding the <see cref="DbContext"/>, not a set of extension methods,
/// because a leaf that correlates against a second table needs that context and a stateless
/// helper cannot reach it.
/// </para>
/// </summary>
/// <typeparam name="TBuilder">The concrete builder, so every step returns the derived type.</typeparam>
/// <typeparam name="TEntity">Entity the query returns.</typeparam>
/// <typeparam name="TFilter">Filter node type of the aggregate.</typeparam>
/// <typeparam name="TSortField">Enum naming the sortable columns of the aggregate.</typeparam>
internal abstract class QueryBuilderBase<TBuilder, TEntity, TFilter, TSortField>
    where TBuilder : QueryBuilderBase<TBuilder, TEntity, TFilter, TSortField>
    where TEntity : class
    where TFilter : IFilterNode<TFilter>
    where TSortField : struct, Enum
{
    /// <summary>
    /// Seeds the query with every row of the entity set, without change tracking. Every read
    /// path of this builder is a projection or a snapshot read, so tracking would only cost
    /// memory and identity-resolution work.
    /// </summary>
    /// <param name="context">Context the query runs on.</param>
    protected QueryBuilderBase(DbContext context)
    {
        Context = context;
        Query = context.Set<TEntity>().AsNoTracking();
    }

    /// <summary>
    /// Context the query runs on. A derived builder uses it to correlate a leaf against a
    /// second table.
    /// </summary>
    protected DbContext Context { get; }

    /// <summary>
    /// The query built so far. Each step replaces it.
    /// </summary>
    protected IQueryable<TEntity> Query { get; set; }

    /// <summary>
    /// Returns the query built so far. Nothing runs against the database until the caller
    /// enumerates the result.
    /// </summary>
    public IQueryable<TEntity> Build() => Query;

    /// <summary>
    /// Applies the filter tree. An empty tree applies no <c>WHERE</c>.
    /// </summary>
    /// <param name="filter">Root filter node of the aggregate.</param>
    /// <returns>This builder.</returns>
    public virtual TBuilder WithFilter(TFilter filter)
    {
        var tree = BuildTree(filter);

        if (tree.IsEmpty)
        {
            return Self;
        }

        // Flat path: one Where per leaf. The SQL is identical to the folded predicate, but
        // the expression trees stay short, so a query log reads clearly and EF caches each
        // shape as its own entry instead of one large combined tree.
        if (tree.Operator == LogicalOperator.And && tree.Groups.Count == 0)
        {
            foreach (var leaf in tree.Leaves)
            {
                Query = Query.Where(leaf);
            }

            return Self;
        }

        // A tree that is not empty always folds to a predicate, so the result is not null.
        Query = Query.Where(tree.ToExpression()!);

        return Self;
    }

    /// <summary>
    /// Applies the sort and then the tie-break.
    /// <para>
    /// The tie-break is not optional and is not the caller's job. A sort on a column with
    /// duplicate values is not a total order, so the database may return two windows over
    /// the same data in different orders. The same row then appears in two windows, or in
    /// none.
    /// </para>
    /// </summary>
    /// <param name="sort">Column, direction, and null placement.</param>
    /// <returns>This builder.</returns>
    public TBuilder WithSorting(SortSpec<TSortField> sort)
    {
        Query = ApplyTieBreak(ApplySort(Query, sort), sort);

        return Self;
    }

    /// <summary>
    /// Applies the window. Call it after <see cref="WithSorting"/>, because a window over an
    /// unordered query has no defined content.
    /// </summary>
    /// <param name="offset">Rows to skip. An offset past the end gives an empty result.</param>
    /// <param name="limit">Rows to take.</param>
    /// <returns>This builder.</returns>
    public TBuilder WithPage(int offset, int limit)
    {
        Query = Query.Skip(offset).Take(limit);

        return Self;
    }

    /// <summary>
    /// Adds the related data the aggregate needs. The base adds none; a derived builder
    /// overrides this when its entity has navigations to load.
    /// </summary>
    /// <returns>This builder.</returns>
    public virtual TBuilder WithIncludes() => Self;

    /// <summary>
    /// Turns one filter node and every child node into a <see cref="FilterGroup{TEntity}"/>
    /// tree of typed predicates.
    /// </summary>
    /// <param name="filter">Node to convert.</param>
    /// <returns>The predicate tree of the node.</returns>
    protected FilterGroup<TEntity> BuildTree(TFilter filter)
        => new(filter.Operator,
               BuildLeaves(filter).ToList(),
               filter.Groups.Select(BuildTree).ToList());

    /// <summary>
    /// Yields one typed predicate for each filter value the node supplies, and nothing for a
    /// value the caller left null.
    /// </summary>
    /// <param name="filter">Node to read the values from. Its child nodes are not read here.</param>
    /// <returns>The predicates of this node only.</returns>
    protected abstract IEnumerable<Expression<Func<TEntity, bool>>> BuildLeaves(TFilter filter);

    /// <summary>
    /// Orders the query by the requested column.
    /// </summary>
    /// <param name="query">Query to order.</param>
    /// <param name="sort">Column, direction, and null placement.</param>
    /// <returns>The ordered query.</returns>
    protected abstract IOrderedQueryable<TEntity> ApplySort(IQueryable<TEntity> query, SortSpec<TSortField> sort);

    /// <summary>
    /// Appends the key that makes the order total. The implementation skips the key when the
    /// requested column is already unique.
    /// </summary>
    /// <param name="query">Query already ordered by <see cref="ApplySort"/>.</param>
    /// <param name="sort">The sort that was applied, so the implementation can skip a redundant key.</param>
    /// <returns>The query under a total order.</returns>
    protected abstract IOrderedQueryable<TEntity> ApplyTieBreak(IOrderedQueryable<TEntity> query, SortSpec<TSortField> sort);

    /// <summary>
    /// Orders on a key that is never null.
    /// </summary>
    /// <typeparam name="TKey">Type of the sort key.</typeparam>
    /// <param name="query">Query to order.</param>
    /// <param name="key">Key to order on.</param>
    /// <param name="direction">Direction to order in.</param>
    /// <returns>The ordered query.</returns>
    protected static IOrderedQueryable<TEntity> Order<TKey>(
        IQueryable<TEntity> query,
        Expression<Func<TEntity, TKey>> key,
        SortDirection direction)
        => direction == SortDirection.Asc ? query.OrderBy(key) : query.OrderByDescending(key);

    /// <summary>
    /// Orders on a key that can be null, with the null placement stated explicitly.
    /// <para>
    /// The order runs on the <paramref name="isNull"/> boolean key first, and only then on
    /// the real key. PostgreSQL places nulls last on <c>ASC</c> and first on <c>DESC</c>, and
    /// SQLite does the opposite. The boolean key removes both defaults, so the placement no
    /// longer depends on the direction or on the provider, and a test on SQLite proves the
    /// behaviour on YugabyteDB.
    /// </para>
    /// </summary>
    /// <typeparam name="TKey">Type of the sort key.</typeparam>
    /// <param name="query">Query to order.</param>
    /// <param name="isNull">Predicate that is true for a row whose key is null.</param>
    /// <param name="key">Key to order on.</param>
    /// <param name="direction">Direction to order the key in.</param>
    /// <param name="nulls">Placement of the null rows.</param>
    /// <returns>The ordered query.</returns>
    protected static IOrderedQueryable<TEntity> OrderNullable<TKey>(
        IQueryable<TEntity> query,
        Expression<Func<TEntity, bool>> isNull,
        Expression<Func<TEntity, TKey>> key,
        SortDirection direction,
        NullPlacement nulls)
    {
        // False sorts before true, so ascending on "is null" puts the null rows last.
        var byNull = nulls == NullPlacement.Last
            ? query.OrderBy(isNull)
            : query.OrderByDescending(isNull);

        return direction == SortDirection.Asc ? byNull.ThenBy(key) : byNull.ThenByDescending(key);
    }

    /// <summary>
    /// This builder as the derived type, so every step chains without a cast at the callsite.
    /// </summary>
    private TBuilder Self => (TBuilder)this;
}
