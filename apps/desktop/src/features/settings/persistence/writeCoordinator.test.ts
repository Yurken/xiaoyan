import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@research-copilot/types";

let coordinator: typeof import("./writeCoordinator");

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// This coordinator only forwards snapshots; these fixtures never reach a
// settings API, database, file, or native command.
function snapshot(model: string): AppSettings {
  return { openai_chat_model: model } as AppSettings;
}

describe("settings persistence read ordering", () => {
  beforeEach(async () => {
    vi.resetModules();
    coordinator = await import("./writeCoordinator");
  });

  it("does not run a later backup recovery ahead of its queued write", async () => {
    let database = snapshot("synthetic-A");
    const events: string[] = [];
    const writeStarted = deferred<void>();
    const releaseWrite = deferred<void>();
    const read = coordinator.readSettingsAfterPersistence(async () => {
      events.push("get");
      return { ...database };
    });

    // Let the idle wait settle and enqueue this read, but reserve B before
    // its queued callback runs. No timers or mocked coordinator internals.
    await Promise.resolve();
    await Promise.resolve();

    let finishRecovery!: () => void;
    finishRecovery = coordinator.reserveSettingsRecovery(async () => {
      events.push("reload:" + database.openai_chat_model);
      const current = { ...database };
      finishRecovery();
      return current;
    });
    const write = coordinator.enqueueSettingsPersistence(async () => {
      events.push("write:start");
      writeStarted.resolve(undefined);
      await releaseWrite.promise;
      database = snapshot("synthetic-B");
      events.push("write:done");
    });

    let beforeRelease: string[] = [];
    try {
      await writeStarted.promise;
      beforeRelease = [...events];
    } finally {
      releaseWrite.resolve(undefined);
      await write;
    }
    const loaded = await read;

    expect(beforeRelease).toEqual(["write:start"]);
    expect(loaded.openai_chat_model).toBe("synthetic-B");
    expect(events).toEqual(["write:start", "write:done", "reload:synthetic-B"]);
    expect(coordinator.hasSettingsRecovery()).toBe(false);
    await coordinator.waitForSettingsPersistence();
  });

  it("waits for a backup reserved while an earlier ordinary read is in flight", async () => {
    let database = snapshot("synthetic-A");
    const events: string[] = [];
    const readStarted = deferred<void>();
    const releaseRead = deferred<void>();
    const read = coordinator.readSettingsAfterPersistence(async () => {
      const oldSnapshot = { ...database };
      events.push("get:start");
      readStarted.resolve(undefined);
      await releaseRead.promise;
      events.push("get:done");
      return oldSnapshot;
    });

    await readStarted.promise;
    let finishRecovery!: () => void;
    finishRecovery = coordinator.reserveSettingsRecovery(async () => {
      events.push("reload:" + database.openai_chat_model);
      const current = { ...database };
      finishRecovery();
      return current;
    });
    const write = coordinator.enqueueSettingsPersistence(async () => {
      events.push("write:start");
      database = snapshot("synthetic-B");
      events.push("write:done");
    });

    releaseRead.resolve(undefined);
    await write;
    const loaded = await read;

    expect(loaded.openai_chat_model).toBe("synthetic-B");
    expect(events).toEqual([
      "get:start", "get:done", "write:start", "write:done", "reload:synthetic-B",
    ]);
    expect(coordinator.hasSettingsRecovery()).toBe(false);
    await coordinator.waitForSettingsPersistence();
  });
});
