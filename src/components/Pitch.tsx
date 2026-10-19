import { Plus } from 'lucide-react';
import type { Formation, PlayerSeason } from '../types/database.ts';
import { initials } from '../utils/display.ts';

export function Pitch({
  formation,
  lineup,
}: {
  formation: Formation;
  lineup?: { slotId: string; player: PlayerSeason }[];
}) {
  return (
    <div
      className={`pitch ${lineup ? 'pitch--roster' : ''}`}
      role="img"
      aria-label={
        lineup
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
      {formation.slots.map((slot) => {
        const player = lineup?.find((entry) => entry.slotId === slot.id)?.player;
        return (
          <div
            className={`pitch-slot ${player ? 'pitch-slot--filled' : ''}`}
            key={slot.id}
            style={{ left: `${slot.coordinates.x * 100}%`, top: `${slot.coordinates.y * 100}%` }}
            aria-hidden="true"
          >
            {player ? (
              <>
                <span className="pitch-player-rating">{player.rating}</span>
                <span className="pitch-player-initials">{initials(player.name)}</span>
                <span className="pitch-player-name">{player.name}</span>
              </>
            ) : (
              <span className="pitch-slot-plus">
                <Plus size={17} strokeWidth={1.3} />
              </span>
            )}
            <span className="pitch-slot-position">{slot.acceptedPositions[0]}</span>
          </div>
        );
      })}
    </div>
  );
}
