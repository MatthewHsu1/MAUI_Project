using System.ComponentModel;

namespace AppName.Domain.Entities.Quotes;

/// <summary>
/// An underlying stock's market price on a given trading day.
/// </summary>
/// <remarks>
/// Creates a stock quote.
/// </remarks>
public sealed class StockQuote(string stockSymbol, decimal price, DateOnly asOf)
{
    /// <summary>
    /// Ticker of the underlying stock.
    /// </summary>
    [DisplayName("Stock Symbol")]
    public string StockSymbol { get; } = stockSymbol;

    /// <summary>
    /// Closing market price of the stock.
    /// </summary>
    [DisplayName("Stock Price")]
    public decimal Price { get; } = price;

    /// <summary>
    /// Trading date this quote applies to.
    /// </summary>
    [DisplayName("As Of")]
    public DateOnly AsOf { get; } = asOf;
}
