# Convertible Bond — Conversion Value Reference

Quick reference for the core convertible-bond (可轉債) conversion math, with the
Chinese terms and their English equivalents.

## Formulas

| Chinese | English | Formula |
|---|---|---|
| 轉換股數 | Conversion shares | `發行面額 / 轉換價` (Par value ÷ Conversion price) |
| 轉換總值 | Conversion value (parity) | `轉換股數 × 標的現價` (Conversion shares × Stock price) |
| 套利 / 價內 | In-the-money condition | `轉換總值 > 公司債市價` (Conversion value > Bond market price) |

### 1. Conversion shares (轉換股數)

```
轉換股數 = 發行面額 / 轉換價
Conversion shares = Par value / Conversion price
```

How many shares the bond converts into.
Example: NT$100,000 par ÷ NT$50 conversion price = **2,000 shares**.

### 2. Conversion value / parity (轉換總值)

```
轉換總值 = 轉換股數 × 標的現價
Conversion value = Conversion shares × Stock (underlying) price
```

The value of the converted shares at the current stock price.
Example: 2,000 shares × NT$60 = **NT$120,000**.

### 3. In-the-money / arbitrage condition

```
轉換總值 > 公司債市價   →   價內 (in-the-money)
Conversion value > Bond market price   →   profitable to convert
```

When the conversion value exceeds the bond's current market price, it is
profitable to **buy the bond, convert into shares, and sell the shares**.

## Terminology note

- **標的 (underlying)** = the **stock**, not the bond. Use it only in formula #2.
- The comparison in #3 should be against the **bond's market price (公司債市價)**,
  *not* "標的現價". Watch for this — labeling the bond price as 標的現價 is a common
  wording mistake.
