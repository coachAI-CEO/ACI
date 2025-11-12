import request from "supertest";
import app from "../app"; // if index exports app, otherwise create a small server export

describe("POST /ai/generate-drill E2E", () => {
  it("MINI2: enforces 2 minis & canonical equipment", async () => {
    const res = await request(app)
      .post("/ai/generate-drill")
      .send({
        gameModelId:"POSSESSION", ageGroup:"U12",
        phase:"ATTACKING", zone:"ATTACKING_THIRD",
        numbersMin:10, numbersMax:12, gkOptional:true,
        goalsAvailable:2, spaceConstraint:"HALF", durationMin:25
      });
    expect(res.status).toBe(200);
    const j = res.body.drill.json;
    expect(j.goalMode).toBe("MINI2");
    expect(j.diagram.miniGoals).toBe(2);
    expect(j.equipment).toEqual(
      expect.arrayContaining(["Cones","Bibs (2 colors)","Soccer balls","2 Mini-goals"])
    );
  });

  it("LARGE: enforces 1 full-size goal & canonical equipment", async () => {
    const res = await request(app)
      .post("/ai/generate-drill")
      .send({
        gameModelId:"PRESSING", ageGroup:"U12",
        phase:"ATTACKING", zone:"ATTACKING_THIRD",
        numbersMin:10, numbersMax:12, gkOptional:true,
        goalsAvailable:1, spaceConstraint:"HALF", durationMin:25
      });
    expect(res.status).toBe(200);
    const j = res.body.drill.json;
    expect(j.goalMode).toBe("LARGE");
    expect(j.diagram.miniGoals).toBe(0);
    expect(j.equipment).toEqual(
      expect.arrayContaining(["Cones","Bibs (2 colors)","Soccer balls","1 Full-size goal"])
    );
    const minis = j.equipment.filter((x:string)=>/mini-goal/i.test(x));
    expect(minis.length).toBe(0);
  });
});
