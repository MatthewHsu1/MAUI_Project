using System.Linq.Expressions;
using AppName.Domain.Querying;

namespace AppName.Domain.Tests.Querying;

public class FilterGroupTests
{
    private sealed record Row(int Id, string Name, int Score);

    private static readonly Row[] Rows =
    [
        new(1, "a", 10),
        new(2, "a", 1),
        new(3, "b", 1),
        new(4, "b", 10),
        new(5, "c", 10)
    ];

    private static FilterGroup<Row> Empty(LogicalOperator op) => new(op, [], []);

    private static FilterGroup<Row> Leaves(LogicalOperator op, params Expression<Func<Row, bool>>[] leaves)
        => new(op, leaves, []);

    [Theory]
    [InlineData(LogicalOperator.And)]
    [InlineData(LogicalOperator.Or)]
    public void ToExpression_ReturnsNull_ForEmptyGroup(LogicalOperator op)
    {
        // An empty Or is match-none in strict boolean algebra. A blank filter must not hide
        // every row, so both operators give the same "no restriction" result.
        Assert.Null(Empty(op).ToExpression());
    }

    [Theory]
    [InlineData(LogicalOperator.And)]
    [InlineData(LogicalOperator.Or)]
    public void ToExpression_ReturnsNull_WhenEveryChildIsEmpty(LogicalOperator op)
    {
        var group = new FilterGroup<Row>(op, [], [Empty(LogicalOperator.And), Empty(LogicalOperator.Or)]);

        Assert.Null(group.ToExpression());
    }

    [Fact]
    public void IsEmpty_IsTrue_ForGroupOfEmptyGroups()
    {
        var group = new FilterGroup<Row>(
            LogicalOperator.Or,
            [],
            [Empty(LogicalOperator.And), new FilterGroup<Row>(LogicalOperator.Or, [], [Empty(LogicalOperator.And)])]);

        Assert.True(group.IsEmpty);
    }

    [Fact]
    public void IsEmpty_IsFalse_WhenDescendantHoldsLeaf()
    {
        var group = new FilterGroup<Row>(
            LogicalOperator.And,
            [],
            [new FilterGroup<Row>(LogicalOperator.Or, [], [Leaves(LogicalOperator.And, r => r.Id == 1)])]);

        Assert.False(group.IsEmpty);
    }

    [Fact]
    public void ToExpression_OrRootOverTwoAndGroups_MatchesEitherBranch()
    {
        var expensive = Leaves(LogicalOperator.And, r => r.Score >= 10, r => r.Name == "a");
        var cheap = Leaves(LogicalOperator.And, r => r.Score < 5, r => r.Name == "b");
        var root = new FilterGroup<Row>(LogicalOperator.Or, [], [expensive, cheap]);

        var predicate = root.ToExpression();

        Assert.NotNull(predicate);

        var matched = Rows.Where(predicate.Compile()).Select(r => r.Id).ToArray();

        Assert.Equal(new[] { 1, 3 }, matched);
    }
}
