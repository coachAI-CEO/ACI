import { postProcessDrill } from "../services/postprocess";

function makeDrill(overrides: any = {}) {
  return {
    json: {
      equipment: overrides.equipment ?? ["Cones or disc markers", "Team bibs", "Footballs", "1 full-sized goal"],
      diagram: overrides.diagram ?? { teams: [{label:"Attack"},{label:"Defend"}], miniGoals: 0 },
      goalsAvailable: overrides.goalsAvailable,
    },
  };
}

test("MINI2 mode enforces 2 minis, no GK, canonical equipment", () => {
  const drill: any = makeDrill({ goalsAvailable: 2 });
  postProcessDrill(drill, { goalsAvailable: 2 });
  expect(drill.json.goalMode).toBe("MINI2");
  expect(drill.json.diagram.miniGoals).toBe(2);
  expect((drill.json.diagram.teams || []).some((t:any)=> (t.label||"").toLowerCase()==="gk")).toBe(false);
  expect(drill.json.equipment).toContain("2 Mini-goals");
  expect(drill.json.equipment).not.toEqual(expect.arrayContaining(["1 Full-size goal"]));
  expect(drill.json.equipment).toContain("Bibs (2 colors)");
  expect(drill.json.equipment).toContain("Soccer balls");
  expect(drill.json.equipment).toContain("Cones");
});

test("LARGE mode enforces 1 large goal, GK present, no minis", () => {
  const drill: any = makeDrill({ goalsAvailable: 1 });
  postProcessDrill(drill, { goalsAvailable: 1 });
  expect(drill.json.goalMode).toBe("LARGE");
  expect(drill.json.diagram.miniGoals).toBe(0);
  expect((drill.json.diagram.teams || []).some((t:any)=> (t.label||"").toLowerCase()==="gk")).toBe(true);
  expect(drill.json.equipment).toContain("1 Full-size goal");
  const minis = drill.json.equipment.filter((x:string)=>/mini-goal/i.test(x));
  expect(minis.length).toBe(0);
});
