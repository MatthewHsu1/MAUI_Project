using System.Linq.Expressions;
using AppName.Domain.Querying;

namespace AppName.Domain.Tests.Querying;

public class PredicateComposerTests
{
    private sealed record Row(int Id, int Score);

    private static readonly Row[] Rows =
    [
        new(1, 5),
        new(2, 10),
        new(3, 15)
    ];

    [Fact]
    public void AndAlso_ProducesLambdaWithOneParameter()
    {
        Expression<Func<Row, bool>> left = r => r.Score >= 10;
        Expression<Func<Row, bool>> right = r => r.Id < 3;

        var composed = left.AndAlso(right);

        // The regression guard for the parameter rebinding. A composer that keeps both
        // parameters still compiles, but EF cannot translate it and the query silently
        // evaluates on the client.
        Assert.Single(composed.Parameters);
    }

    [Fact]
    public void OrElse_ProducesLambdaWithOneParameter()
    {
        Expression<Func<Row, bool>> left = r => r.Score >= 10;
        Expression<Func<Row, bool>> right = r => r.Id < 3;

        var composed = left.OrElse(right);

        Assert.Single(composed.Parameters);
    }

    [Fact]
    public void AndAlso_Compiled_ReturnsIntersection()
    {
        Expression<Func<Row, bool>> left = r => r.Score >= 10;
        Expression<Func<Row, bool>> right = r => r.Id < 3;

        var matched = Rows.Where(left.AndAlso(right).Compile()).Select(r => r.Id).ToArray();

        Assert.Equal(new[] { 2 }, matched);
    }

    [Fact]
    public void OrElse_Compiled_ReturnsUnion()
    {
        Expression<Func<Row, bool>> left = r => r.Score >= 15;
        Expression<Func<Row, bool>> right = r => r.Id == 1;

        var matched = Rows.Where(left.OrElse(right).Compile()).Select(r => r.Id).ToArray();

        Assert.Equal(new[] { 1, 3 }, matched);
    }
}
