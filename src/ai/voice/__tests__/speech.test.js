import { describe, it, expect, vi, beforeEach } from "vitest";
import { voice } from "../speech.js";

describe("voice module", () => {
  describe("sttSupported / ttsSupported", () => {
    it("exposes boolean flags", () => {
      expect(typeof voice.sttSupported).toBe("boolean");
      expect(typeof voice.ttsSupported).toBe("boolean");
    });
  });

  describe("listen()", () => {
    it("calls onError when STT is not available", () => {
      if (voice.sttSupported) return;
      const onError = vi.fn();
      voice.listen({ onError });
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("returns a controller with stop()", () => {
      const ctrl = voice.listen({ onError: () => {} });
      expect(typeof ctrl.stop).toBe("function");
    });
  });

  describe("speak()", () => {
    it("returns false when TTS is not supported", () => {
      if (voice.ttsSupported) return;
      expect(voice.speak("hello")).toBe(false);
    });
  });

  describe("stopSpeaking()", () => {
    it("does not throw", () => {
      expect(() => voice.stopSpeaking()).not.toThrow();
    });
  });
});
