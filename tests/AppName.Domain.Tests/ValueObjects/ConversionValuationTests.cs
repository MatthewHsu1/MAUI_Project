using AppName.Domain.ValueObjects;

namespace AppName.Domain.Tests.ValueObjects;

public class ConversionValuationTests
{
    [Fact]
    public void Calculate_DividesParByConversionPrice_ForShares()
    {
        var v = ConversionValuation.Calculate(parValue: 100_000m, conversionPrice: 50m, stockPrice: 60m);
        Assert.Equal(2_000m, v.ConversionShares);
    }

    [Fact]
    public void Calculate_MultipliesSharesByStockPrice_ForValue()
    {
        var v = ConversionValuation.Calculate(100_000m, 50m, 60m);
        Assert.Equal(120_000m, v.ConversionValue);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-50)]
    public void Calculate_Throws_WhenConversionPriceNotPositive(decimal badPrice)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => ConversionValuation.Calculate(100_000m, badPrice, 60m));
    }
}
