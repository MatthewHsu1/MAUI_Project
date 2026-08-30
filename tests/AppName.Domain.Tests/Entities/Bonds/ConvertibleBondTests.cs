using AppName.Domain.Entities.Bonds;

namespace AppName.Domain.Tests.Entities.Bonds;

public class ConvertibleBondTests
{
    [Fact]
    public void Constructor_SetsAllTerms()
    {
        var b = new ConvertibleBond("11011", "台泥一永", 100_000m, 36.5m, "1101");
        Assert.Equal("11011", b.Symbol);
        Assert.Equal("台泥一永", b.Name);
        Assert.Equal(100_000m, b.ParValue);
        Assert.Equal(36.5m, b.ConversionPrice);
        Assert.Equal("1101", b.UnderlyingSymbol);
    }

    [Fact]
    public void UpdateTerms_OverwritesParAndConversionPrice()
    {
        var b = new ConvertibleBond("11011", "台泥一永", 100_000m, 36.5m, "1101");
        b.UpdateTerms(100_000m, 34.0m);
        Assert.Equal(100_000m, b.ParValue);
        Assert.Equal(34.0m, b.ConversionPrice);
    }

    [Fact]
    public void Constructor_Throws_WhenSymbolBlank()
    {
        Assert.Throws<ArgumentException>(() => new ConvertibleBond(" ", "x", 100_000m, 36.5m, "1101"));
    }
}
