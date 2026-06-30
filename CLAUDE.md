# Project conventions

## C# documentation & display naming

These rules apply **only to the C# project** (not the React/web code).

### XML documentation

- **Interfaces**: every interface and its members (methods, properties, events) MUST have a concise `/// <summary>` describing the contract.
- **Model properties**: every property on a model/DTO MUST have a `/// <summary>`. Also document `enum` types and their values.
- **Implementations**: classes that implement an interface (or override/inherit a documented member) MUST use `/// <inheritdoc/>` on the implementing members instead of repeating the summary. Only write a fresh `/// <summary>` when the implementation adds behavior the interface doc doesn't cover.

### Display naming

- **Model properties**: every property on a model MUST carry a `[DisplayName("Human Readable Name")]` attribute so it renders correctly in UI, reports, exports, and filters.
