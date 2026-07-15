// HybridWebView injects this global at runtime.
declare const HybridWebView: {
  InvokeDotNet: (methodName: string, args?: unknown[]) => Promise<unknown>;
};

export function invoke<T>(method: string, args?: unknown[]): Promise<T> {
  return (
    args !== undefined
      ? HybridWebView.InvokeDotNet(method, args)
      : HybridWebView.InvokeDotNet(method)
  ) as Promise<T>;
}
