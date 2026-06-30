import { useEffect, useState } from "react";
import { bridge } from "../../bridge/client";
import type { UserDto } from "../../bridge/types";

export function UsersList() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bridge.users
      .getAll()
      .then(setUsers)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <p>Bridge error: {error}</p>;
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.name} — {u.email}
        </li>
      ))}
    </ul>
  );
}
