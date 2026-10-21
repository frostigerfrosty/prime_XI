import { Plus } from 'lucide-react';
import type { Formation, PlayerSeason } from '../types/database.ts';
import { initials } from '../utils/display.ts';

export function Pitch({
  formation,
  lineup,
  selectedSlotId,
  captainPersonId,
  onSelect,
}: {
  formation: Formation;
  lineup?: { slotId: string; player: PlayerSeason }[];
  selectedSlotId?: string | null;
  captainPersonId?: string | null;
  onSelect?: (slotId: string) => void;
}) {
  return (
    <div
      className={`pitch ${lineup ? 'pitch--roster' : ''}`}
      role={onSelect ? 'group' : 'img'}
      aria-label={
        onSelect
          ? `Deine Aufstellung in Formation ${formation.id}`
          : lineup
            ? `Standardelf in Formation ${formation.id}: ${lineup.map(({ player }) => player.name).join(', ')}`
            : `Leere Aufstellung in Formation ${formation.id}, elf unbesetzte Positionen`
      }
    >
      <div className="pitch-lines" aria-hidden="true">
        <span className="pitch-half" />
        <span className="pitch-circle" />
        <span className="pitch-box pitch-box--top" />
        <span className="pitch-box pitch-box--bottom" />
        <span className="pitch-goal pitch-goal--top" />
        <span className="pitch-goal pitch-goal--bottom" />
      </div>
      {formation.slots.map((slot, index) => {
        const player = lineup?.find((entry) => entry.slotId === slot.id)?.player;
        const content = (
          <>
            {player ? (
              <>
                <span className="pitch-player-rating">{player.rating}</span>
                <span className="pitch-player-initials">{initials(player.name)}</span>
                <span className="pitch-player-name">{player.name}</span>
                {captainPersonId === player.personId && <span className="pitch-captain">C</span>}
              </>
            ) : (
              <span className="pitch-slot-plus">
                <Plus size={17} strokeWidth={1.3} />
              </span>
            )}
            <span className="pitch-slot-position">{slot.acceptedPositions[0]}</span>
          </>
        );
        const style = { left: `${slot.coordinates.x * 100}%`, top: `${slot.coordinates.y * 100}%` };
        if (onSelect)
          return (
            <button
              key={slot.id}
              type="button"
              className={`pitch-slot pitch-slot--interactive ${player ? 'pitch-slot--filled' : ''} ${selectedSlotId === slot.id ? 'pitch-slot--selected' : ''}`}
              style={style}
              aria-pressed={selectedSlotId === slot.id}
              aria-label={`${slot.acceptedPositions[0]} · Position ${index + 1} · ${player ? `${player.name}${captainPersonId === player.personId ? ' · Captain' : ''}` : 'Spieler wählen'}`}
              onClick={() => onSelect(slot.id)}
            >
              {content}
            </button>
          );
        return (
          <div
            className={`pitch-slot ${player ? 'pitch-slot--filled' : ''}`}
            key={slot.id}
            style={style}
            aria-hidden="true"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
