import { describe, it, expect } from "vitest";
import { normLaunch } from "../normalize";

describe("normLaunch", () => {
  it("deja en null lo que no viene (no inventa datos)", () => {
    const r = normLaunch({ id: "x", slug: "x", name: "Test", response_mode: "normal", failreason: "" });
    expect(r.launch.net).toBeNull();
    expect(r.launch.failReason).toBeNull();
    expect(r.pad).toBeNull();
    expect(r.videos).toBeNull(); // normal: no toca los videos existentes
  });

  it("extrae país, pad y videos oficiales en modo detailed", () => {
    const r = normLaunch({
      id: "y", slug: "y", name: "Y", response_mode: "detailed", net: "2026-10-01T15:10:00Z",
      net_precision: { abbrev: "MIN" }, status: { id: 1, abbrev: "Go", name: "Go for Launch" },
      pad: { id: 1, name: "LC-39A", latitude: 28.6, longitude: -80.6, country: { alpha_3_code: "USA" }, location: { id: 27, name: "KSC" } },
      vid_urls: [{ url: "https://youtu.be/a", type: { name: "Official Webcast" } }], info_urls: [],
    });
    expect(r.launch.countryCode).toBe("USA");
    expect(r.launch.locationId).toBe(27);
    expect(r.launch.net?.toISOString()).toBe("2026-10-01T15:10:00.000Z");
    expect(r.videos?.[0].typeName).toBe("Official Webcast");
  });

  it("no guarda raw de un cohete en versión reducida (no pisa la ficha técnica)", () => {
    const base = { id: "z", slug: "z", name: "Z", response_mode: "normal" };
    const mini = normLaunch({ ...base, rocket: { configuration: { id: 164, name: "Falcon 9", full_name: "Falcon 9 Block 5" } } });
    expect(mini.rocketConfig?.raw).toBeNull();
    const full = normLaunch({ ...base, rocket: { configuration: { id: 164, name: "Falcon 9", response_mode: "detailed", max_stage: 2 } } });
    expect(full.rocketConfig?.raw).not.toBeNull();
  });
});
