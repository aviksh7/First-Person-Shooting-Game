import { describe, expect, it } from "vitest";
import { EventBus } from "../../game/EventBus";

interface TestEvents {
  readonly scoreChanged: number;
}

describe("EventBus", () => {
  it("subscribes, emits, and unsubscribes typed events", () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    const unsubscribe = bus.subscribe("scoreChanged", (score) => {
      received.push(score);
    });

    bus.emit("scoreChanged", 10);
    unsubscribe();
    bus.emit("scoreChanged", 20);

    expect(received).toEqual([10]);
  });
});
