import type { UserDto } from "./types";

// HybridWebView injects this global at runtime.
declare const HybridWebView: {
  InvokeDotNet: (methodName: string, args?: unknown[]) => Promise<unknown>;
};

function invoke<T>(method: string, args?: unknown[]): Promise<T> {
  return (args !== undefined
    ? HybridWebView.InvokeDotNet(method, args)
    : HybridWebView.InvokeDotNet(method)) as Promise<T>;
}

export const bridge = {
  users: {
    getAll: (): Promise<UserDto[]> => invoke<UserDto[]>("GetUsers"),
    add: (name: string, email: string): Promise<UserDto> =>
      invoke<UserDto>("AddUser", [name, email]),
  },
};
