# Project conventions

## C# documentation & display naming

These rules apply **only to the C# project** (not the React/web code).

### XML documentation

- **Comment shape**: write every `<summary>` (and other XML doc tags) in the multi-line form — the opening tag, the text, and the closing tag each on their own `///` line. Do NOT collapse a summary onto a single line.

  ```csharp
  /// <summary>
  /// Number of shares the bond converts into (par value / conversion price).
  /// </summary>
  [DisplayName("Conversion Shares")]
  public decimal ConversionShares { get; }
  ```

- **Interfaces**: every interface and its members (methods, properties, events) MUST have a concise `/// <summary>` describing the contract.
- **Model properties**: every property on a model/DTO MUST have a `/// <summary>`. Also document `enum` types and their values.
- **Implementations**: classes that implement an interface (or override/inherit a documented member) MUST use `/// <inheritdoc/>` on the implementing members instead of repeating the summary. Only write a fresh `/// <summary>` when the implementation adds behavior the interface doc doesn't cover.

### Display naming

- **Model properties**: every property on a model MUST carry a `[DisplayName("Human Readable Name")]` attribute so it renders correctly in UI, reports, exports, and filters.

## C# unit testing

- When writing, reviewing, or refactoring **C# unit tests**, follow [docs/TestingConventionGuidance.md](docs/TestingConventionGuidance.md) — it is the authoritative guidance for this solution's xUnit + Moq conventions (the nested `Fixture` pattern, when to mock vs. use a real/hand-written double, test naming, and file placement). Read it before adding or changing tests.


## Typescript Styling
Format the code for human readability after implementing it. Group related statements into logical sections separated by a single blank line. Prefer multi-line if statements over one-line returns, and optimize for maintainability rather than minimal diff.
