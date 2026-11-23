const pool = [
  ['ニアミス 5 回', run => run.nearMisses >= 5],
  ['星屑 40 個', run => run.shards >= 40],
  ['800 m 到達', run => run.distance >= 800],
  ['ゲート 8 回通過', run => run.gates >= 8],
  ['シールド取得', run => run.shields >= 1],
  ['コンボ ×2.0 到達', run => run.maxCombo >= 10],
];

export const missionBonus = 300;

export function selectMissions() {
  const choices = [...pool];
  return Array.from({ length: 3 }, () => {
    const [label, reached] = choices.splice(Math.floor(Math.random() * choices.length), 1)[0];
    return { label, reached, done: false };
  });
}

export function scoreRank(score) {
  return [[8000, 'S'], [4500, 'A'], [2500, 'B'], [1200, 'C']]
    .find(([threshold]) => score >= threshold)?.[1] ?? 'D';
}
