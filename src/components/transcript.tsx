import type { Turn } from "@/lib/game/types";
import type { Evidence } from "@/lib/game/types";
import AnimatedList from "@/components/react-bits/animated-list";

export function Transcript({ turns, evidence = [] }: { turns: Turn[]; evidence?: Evidence[] }) {
  if (turns.length === 0) {
    return <div className="empty-transcript">The recorder is running. Your first answer will set the room's temperature.</div>;
  }

  return <div className="transcript" aria-label="Interview transcript">
    <AnimatedList
      className="transcript-list"
      items={turns.map((turn) => ({
        id: turn.round,
        content: <article className="turn">
          <div className="turn-meta"><span>Round {String(turn.round).padStart(2, "0")}</span><span>{turn.reaction}</span></div>
          {evidence[turn.round - 1]?.question && <p className="turn-question">{evidence[turn.round - 1]?.question}</p>}
          <p>{turn.statement}</p>
          <p className="turn-reply">{turn.detectiveReply}</p>
        </article>,
      }))}
      itemGap={0}
      height="auto"
    />
  </div>;
}
