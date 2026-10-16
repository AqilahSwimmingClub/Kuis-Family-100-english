import type { Action } from "./engine";
import type { Game } from "./schemas";
import type { Sound } from "./audio";

export type AudioCue = { name: Sound; points?: number };
/** Called only after the reducer accepts an action; never from render/effects. */
export function soundForAction(
  before: Game,
  after: Game,
  action: Action,
): AudioCue | null {
  if (before === after) return null;
  const previous = before.rounds[before.current];
  const current = after.rounds[after.current];
  switch (action.type) {
    case "reveal":
      return {
        name: previous.phase === "steal" ? "steal-success" : "correct",
        points: after.questions[after.current].answers[action.answer].points,
      };
    case "wrong":
      return { name: previous.phase === "steal" ? "steal-fail" : "wrong" };
    case "steal":
      return { name: "steal" };
    case "navigate":
      return before.current !== after.current ? { name: "question" } : null;
    case "recipient":
      return previous.recipient !== current.recipient ? { name: "turn" } : null;
    case "tick":
      return current.remaining === 0
        ? { name: "timeout" }
        : current.remaining <= 5
          ? { name: "countdown" }
          : null;
    case "showAll":
      return previous.revealed.length !== current.revealed.length
        ? { name: "reveal" }
        : null;
    case "end":
      return !before.finished && after.finished ? { name: "winner" } : null;
    case "adjust":
      return action.delta > 0 ? { name: "score", points: action.delta } : null;
    default:
      return null;
  }
}
