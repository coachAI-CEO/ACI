"use client";

import { useEnforcedGameModelScope } from "@/lib/game-model-scope";

type Props = {
  name?: string;
  defaultValue?: string;
  className?: string;
  id?: string;
};

/**
 * Game-model <select> that collapses to the club-assigned model when the
 * signed-in user is scoped (coach / DOC / section director membership).
 * While scope is loading, shows a locked placeholder so the full catalog
 * never flashes open.
 *
 * Disabled selects are omitted from FormData — when locked we mirror the
 * value with a hidden input so Generate still posts the club model.
 */
export default function ScopedGameModelSelect({
  name = "gameModelId",
  defaultValue = "POSSESSION",
  className,
  id,
}: Props) {
  const { enforcedGameModelId, scopedGameModelOptions, scopeReady } =
    useEnforcedGameModelScope();
  const value = enforcedGameModelId || defaultValue;
  const locked = Boolean(enforcedGameModelId) || !scopeReady;

  if (!scopeReady) {
    return (
      <>
        <select
          id={id}
          disabled
          className={className}
          aria-busy="true"
          title="Resolving your club game model…"
          value=""
          onChange={() => undefined}
        >
          <option value="">Resolving club model…</option>
        </select>
        <input type="hidden" name={name} value={defaultValue} />
      </>
    );
  }

  return (
    <>
      <select
        key={value}
        id={id}
        name={locked ? undefined : name}
        defaultValue={value}
        disabled={locked}
        className={className}
        title={
          enforcedGameModelId
            ? `Locked to your club game model (${enforcedGameModelId})`
            : undefined
        }
      >
        {scopedGameModelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {locked ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}
