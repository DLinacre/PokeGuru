import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackResult, PulledCard, RarityTier } from "../src/types/packs";

const KEY = "pokeguru_pack_sim_v1";

function pull(tier: RarityTier, id: string): PulledCard {
  return {
    id,
    name: `Card ${id}`,
    localId: id.split("-").pop() ?? "1",
    setId: "sv06.5",
    setName: "Shrouded Fable",
    rarity: tier,
    tier,
    treatment: tier === "common" ? "normal" : "holo",
    image: `https://assets.tcgdex.net/en/sv/sv06.5/${id}/low.webp`,
    slot: tier === "common" ? "common" : "rare",
  };
}

function pack(id: string, tiers: RarityTier[] = ["common", "uncommon", "rare"]): PackResult {
  const cards = tiers.map((tier, index) => pull(tier, `${id}-${index + 1}`));
  return {
    id,
    setId: "sv06.5",
    setName: "Shrouded Fable",
    seriesId: "sv",
    configId: "sv",
    openedAt: 1_700_000_000_000,
    seed: "seed",
    cards,
    bestTier: tiers[tiers.length - 1] ?? null,
  };
}

async function loadStore() {
  vi.resetModules();
  return import("../src/services/simStore");
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("simulated collection store", () => {
  it("starts empty and uses its own storage key", async () => {
    const store = await loadStore();
    expect(store.getSimSnapshot().packsOpened).toBe(0);
    expect(store.SIM_STORAGE_KEY).toBe(KEY);
    expect(store.SIM_STORAGE_KEY).not.toBe("pokeguru_collection");
  });

  it("records packs, quantities and history", async () => {
    const store = await loadStore();
    store.recordPacks([pack("p1", ["common", "common", "rare"])]);
    store.recordPacks([pack("p2", ["common", "specialIllustrationRare"])]);

    const state = store.getSimSnapshot();
    expect(state.packsOpened).toBe(2);
    expect(state.history.map((entry) => entry.id)).toEqual(["p2", "p1"]);
    expect(Object.values(state.cards)).toHaveLength(5);
    expect(state.cards["p1-1"].quantity).toBe(1);
    expect(state.cards["p1-3"].card.tier).toBe("rare");
  });

  it("counts duplicates instead of overwriting them", async () => {
    const store = await loadStore();
    const repeated = pack("dup", ["common", "common"]);
    store.recordPacks([repeated, repeated, repeated]);
    const state = store.getSimSnapshot();
    expect(state.cards["dup-1"].quantity).toBe(3);
    expect(store.summariseSim(state).totalCards).toBe(6);
    expect(store.summariseSim(state).dupes).toBe(4);
  });

  it("persists across a reload", async () => {
    const first = await loadStore();
    first.recordPacks([pack("persist", ["rare"])]);

    const second = await loadStore();
    const state = second.getSimSnapshot();
    expect(state.packsOpened).toBe(1);
    expect(state.cards["persist-1"]).toBeTruthy();
  });

  it("keeps history bounded", async () => {
    const store = await loadStore();
    for (let index = 0; index < 60; index += 1) {
      store.recordPacks([pack(`p${index}`)]);
    }
    expect(store.getSimSnapshot().history).toHaveLength(40);
    expect(store.getSimSnapshot().packsOpened).toBe(60);
  });

  it("survives rapid successive openings without losing state", async () => {
    const store = await loadStore();
    const batch = Array.from({ length: 50 }, (_, index) => pack(`batch-${index}`, ["common", "rare"]));
    store.recordPacks(batch);
    expect(store.getSimSnapshot().packsOpened).toBe(50);
    expect(Object.keys(store.getSimSnapshot().cards)).toHaveLength(100);
  });

  it("never touches the real collection key", async () => {
    localStorage.setItem("pokeguru_collection", JSON.stringify([{ addedAt: 1, card: { id: "base1-4", name: "Charizard" } }]));
    const before = localStorage.getItem("pokeguru_collection");

    const store = await loadStore();
    store.recordPacks([pack("isolated")]);
    store.resetSim();

    expect(localStorage.getItem("pokeguru_collection")).toBe(before);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}").packsOpened).toBe(0);
  });

  it("resets simulated data while keeping the user's sound and motion settings", async () => {
    const store = await loadStore();
    store.recordPacks([pack("reset-me")]);
    store.updateSimSettings({ sound: false, reduceMotion: true });

    const state = store.resetSim();
    expect(state.packsOpened).toBe(0);
    expect(state.cards).toEqual({});
    expect(state.settings.sound).toBe(false);
    expect(state.settings.reduceMotion).toBe(true);
  });

  it("reports rarest pulls first", async () => {
    const store = await loadStore();
    store.recordPacks([pack("rarest", ["common", "ultraRare", "specialIllustrationRare"])]);
    const rarest = store.rarestPulls(store.getSimSnapshot(), 3);
    expect(rarest[0].card.tier).toBe("specialIllustrationRare");
    expect(rarest[1].card.tier).toBe("ultraRare");
    expect(rarest[2].card.tier).toBe("common");
  });

  it("recovers from corrupt storage instead of crashing", () => {
    localStorage.setItem(KEY, "{not json");
    return loadStore().then((store) => {
      expect(store.getSimSnapshot().packsOpened).toBe(0);
    });
  });

  it("drops malformed card records but keeps valid ones", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        packsOpened: 2,
        settings: { sound: false, reduceMotion: false, wrapperStyle: "prism" },
        cards: {
          ok: { card: { id: "x-1", name: "Ok", setId: "x", setName: "X", tier: "rare" }, quantity: 4, firstPulledAt: 1 },
          bad: { card: { id: "", name: "No id" }, quantity: 1 },
        },
        history: [],
      })
    );
    const store = await loadStore();
    const state = store.getSimSnapshot();
    expect(Object.keys(state.cards)).toEqual(["x-1"]);
    expect(state.cards["x-1"].quantity).toBe(4);
    expect(state.settings.sound).toBe(false);
    expect(state.settings.wrapperStyle).toBe("prism");
  });
});
