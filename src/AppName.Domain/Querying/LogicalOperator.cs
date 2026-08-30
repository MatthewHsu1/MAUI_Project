namespace AppName.Domain.Querying;

/// <summary>
/// Joins the leaves and the child groups of one filter node.
/// </summary>
public enum LogicalOperator
{
    /// <summary>
    /// Every leaf and every child group of the node must match.
    /// </summary>
    And,

    /// <summary>
    /// At least one leaf or one child group of the node must match.
    /// </summary>
    Or
}
