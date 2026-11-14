import { describe, expect, it } from "vitest";
import { extractCardNumber, extractNameCandidates, normaliseName, scoreMatch } from "../src/utils/ocrParse";

const SAMPLE = `Charizard ex
Stage 2 HP 330
Evolves from Charmeleon
Ability: Infernal Reign
When you play this card to evolve a Pokemon, search your deck...
Burning Darkness 180+
This attack does 30 more damage for each Prize card...
Weakness: Water x2
Retreat: 2
006/165
Illus. by Mitsuhiro Arita`;

describe("OCR text parsing", () => {
  it("extracts the card name and ignores rules text", () => {
    const candidates = extractNameCandidates(SAMPLE);
    expect(candidates[0].name.toLowerCase()).toBe("charizard ex");
    expect(candidates.map((candidate) => candidate.name.toLowerCase())).not.toContain("weakness: water x2");
  });

  it("returns nothing for unreadable text instead of guessing", () => {
    expect(extractNameCandidates("")).toEqual([]);
    expect(extractNameCandidates("~~~ /// 12345 ~~~")).toEqual([]);
    expect(extractNameCandidates("Weakness: Fire\nResistance: Water")).toEqual([]);
  });

  it("ignores stage/HP noise lines", () => {
    const candidates = extractNameCandidates("BASIC\nPikachu\n60 HP\nThunder Jolt 30");
    expect(candidates[0].name).toBe("Pikachu");
    expect(candidates.map((candidate) => candidate.name)).not.toContain("BASIC");
    expect(candidates.map((candidate) => candidate.name)).not.toContain("60 HP");
  });

  it("finds collector numbers", () => {
    expect(extractCardNumber(SAMPLE)).toEqual({ number: "006", total: "165" });
    expect(extractCardNumber("TG05/TG30")).toEqual({ number: "TG05", total: "TG30" });
    expect(extractCardNumber("no number here")).toBeNull();
  });

  it("scores exact names above partial matches", () => {
    expect(scoreMatch("Charizard ex", { name: "Charizard ex", localId: "006" })).toBeGreaterThan(
      scoreMatch("Charizard ex", { name: "Charizard", localId: "004" })
    );
  });

  it("rewards a matching collector number", () => {
    const withoutNumber = scoreMatch("Pikachu", { name: "Pikachu", localId: "058" });
    const withNumber = scoreMatch("Pikachu", { name: "Pikachu", localId: "058" }, "58");
    expect(withNumber).toBeGreaterThan(withoutNumber);
    expect(normaliseName("Mr. Mime")).toBe("mrmime");
  });
});
