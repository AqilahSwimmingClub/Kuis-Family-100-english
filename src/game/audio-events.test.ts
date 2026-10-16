import { expect, it } from "vitest";
import { QUESTIONS } from "../data/questions";
import { createGame, gameReducer, scores, type Action } from "./engine";
import { soundForAction } from "./audio-events";

it("sounds only a newly credited answer and leaves duplicate scoring silent", () => {
  const before = createGame(QUESTIONS);
  const action: Action = { type: "reveal", answer: 0 };
  const after = gameReducer(before, action);
  expect(soundForAction(before, after, action)).toEqual({
    name: "correct",
    points: 40,
  });
  const duplicate = gameReducer(after, action);
  expect(soundForAction(after, duplicate, action)).toBeNull();
  expect(scores(duplicate)[0]).toBe(40);
});

it("distinguishes explicit wrong answers and the two steal outcomes", () => {
  let game = createGame(QUESTIONS);
  for (let i = 0; i < 3; i++) {
    const next = gameReducer(game, { type: "wrong" });
    expect(soundForAction(game, next, { type: "wrong" })).toEqual({
      name: "wrong",
    });
    game = next;
  }
  const steal: Action = { type: "steal", team: 1 };
  const stealing = gameReducer(game, steal);
  expect(soundForAction(game, stealing, steal)).toEqual({ name: "steal" });
  const win: Action = { type: "reveal", answer: 0 };
  expect(soundForAction(stealing, gameReducer(stealing, win), win)).toEqual({
    name: "steal-success",
    points: 40,
  });
  expect(
    soundForAction(stealing, gameReducer(stealing, { type: "wrong" }), {
      type: "wrong",
    }),
  ).toEqual({ name: "steal-fail" });
});

it("transitions only to a different question and chimes only for a changed recipient", () => {
  const game = createGame(QUESTIONS);
  for (const action of [
    { type: "navigate", index: 0 },
    { type: "recipient", team: 0 },
  ] as Action[]) {
    expect(soundForAction(game, gameReducer(game, action), action)).toBeNull();
  }
  const navigate: Action = { type: "navigate", index: 1 };
  expect(soundForAction(game, gameReducer(game, navigate), navigate)).toEqual({
    name: "question",
  });
  const recipient: Action = { type: "recipient", team: 1 };
  expect(soundForAction(game, gameReducer(game, recipient), recipient)).toEqual(
    { name: "turn" },
  );
});

it("ticks for exactly five final seconds and buzzes once at timeout", () => {
  let game = createGame(QUESTIONS, {
    timer: 10,
    sound: true,
    steal: true,
    translation: true,
  });
  const names: string[] = [];
  for (let i = 0; i < 12; i++) {
    const next = gameReducer(game, { type: "tick" });
    const cue = soundForAction(game, next, { type: "tick" });
    if (cue) names.push(cue.name);
    game = next;
  }
  expect(names).toEqual([
    "countdown",
    "countdown",
    "countdown",
    "countdown",
    "countdown",
    "timeout",
  ]);
});

it("announces a new finish once and does not fanfare a restored or repeated finish", () => {
  const game = createGame(QUESTIONS);
  const ended = gameReducer(game, { type: "end" });
  expect(soundForAction(game, ended, { type: "end" })).toEqual({
    name: "winner",
  });
  expect(
    soundForAction(ended, gameReducer(ended, { type: "end" }), { type: "end" }),
  ).toBeNull();
});

it("reveals show-all without a correct-answer cue or additional points", () => {
  const game = createGame(QUESTIONS);
  const next = gameReducer(game, { type: "showAll" });
  expect(soundForAction(game, next, { type: "showAll" })).toEqual({
    name: "reveal",
  });
  expect(scores(next)).toEqual([0, 0, 0, 0, 0]);
  expect(
    soundForAction(next, gameReducer(next, { type: "showAll" }), {
      type: "showAll",
    }),
  ).toBeNull();
});

it("sounds positive manual points without turning deductions into wrong answers", () => {
  const game = createGame(QUESTIONS);
  const plus: Action = { type: "adjust", team: 2, delta: 50 };
  expect(soundForAction(game, gameReducer(game, plus), plus)).toEqual({
    name: "score",
    points: 50,
  });
  const minus: Action = { type: "adjust", team: 2, delta: -10 };
  expect(soundForAction(game, gameReducer(game, minus), minus)).toBeNull();
});

it("passes the credited answer's actual points to the shared score and celebration scene", () => {
  for (const answer of [0, 1, 2, 3]) {
    const game = createGame(QUESTIONS);
    const action: Action = { type: "reveal", answer };
    const next = gameReducer(game, action);
    const points = game.questions[0].answers[answer].points;
    expect(soundForAction(game, next, action)).toEqual({
      name: "correct",
      points,
    });
    expect(scores(next)[0] - scores(game)[0]).toBe(points);
  }
});

it("keeps rejected gameplay actions silent instead of sounding success or failure", () => {
  const game = createGame(QUESTIONS);
  const paused = gameReducer(game, { type: "pause" });
  const timed = createGame(QUESTIONS, {
    timer: 10,
    sound: true,
    steal: true,
    translation: true,
  });
  let timedOut = timed;
  for (let second = 0; second < 10; second++) {
    timedOut = gameReducer(timedOut, { type: "tick" });
  }
  const untimed = createGame(QUESTIONS, { ...game.settings, timer: 0 });
  const cases: [typeof game, Action][] = [
    [paused, { type: "reveal", answer: 0 }],
    [paused, { type: "wrong" }],
    [game, { type: "reveal", answer: -1 }],
    [game, { type: "steal", team: 1 }],
    [game, { type: "navigate", index: QUESTIONS.length }],
    [game, { type: "recipient", team: 5 }],
    [game, { type: "adjust", team: 5, delta: 50 }],
    [untimed, { type: "tick" }],
    [timedOut, { type: "reveal", answer: 0 }],
    [timedOut, { type: "wrong" }],
    [timedOut, { type: "tick" }],
  ];
  for (const [before, action] of cases) {
    const after = gameReducer(before, action);
    expect(after).toBe(before);
    expect(soundForAction(before, after, action)).toBeNull();
    expect(scores(after)).toEqual(scores(before));
  }
});

it("does not reuse gameplay effects for settings, pause, undo, or resetting a round", () => {
  const original = createGame(QUESTIONS);
  const game = gameReducer(original, { type: "reveal", answer: 0 });
  const actions: Action[] = [
    { type: "settings", settings: { ...game.settings, translation: false } },
    { type: "teams", teams: game.teams.map(team => ({ ...team, name: `${team.name}!` })) },
    { type: "pause" },
    { type: "undo" },
    { type: "resetRound" },
    { type: "restartTimer" },
  ];
  for (const action of actions) {
    const next = gameReducer(game, action);
    expect(soundForAction(game, next, action)).toBeNull();
  }
});
