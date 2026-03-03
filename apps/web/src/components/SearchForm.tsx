import { useState } from "react";
import type { Platform } from "@chessgg/shared";

type SearchFormProps = {
  defaultPlatform?: Platform;
  defaultUsername?: string;
  onSubmit: (payload: { platform: Platform; username: string }) => void;
  disabled?: boolean;
};

export function SearchForm({
  defaultPlatform = "chesscom",
  defaultUsername = "",
  onSubmit,
  disabled,
}: SearchFormProps) {
  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const [username, setUsername] = useState(defaultUsername);

  return (
    <form
      className="search-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!username.trim()) {
          return;
        }
        onSubmit({ platform, username: username.trim() });
      }}
    >
      <select
        value={platform}
        onChange={(event) => setPlatform(event.target.value as Platform)}
        disabled={disabled}
      >
        <option value="chesscom">Chess.com</option>
        <option value="lichess">Lichess</option>
      </select>
      <input
        placeholder="닉네임 입력"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        검색
      </button>
    </form>
  );
}
