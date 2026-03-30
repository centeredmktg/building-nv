import {
  cosineSimilarity,
  chunkText,
  VectorStore,
} from "@/lib/compliance/vector-search";

describe("vector-search", () => {
  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      const v = [1, 0, 0];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
    });

    it("returns 0 for orthogonal vectors", () => {
      expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    });

    it("returns -1 for opposite vectors", () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
    });
  });

  describe("chunkText", () => {
    it("returns the full text when under the chunk size", () => {
      const chunks = chunkText("short text", 100);
      expect(chunks).toEqual(["short text"]);
    });

    it("splits text into roughly equal chunks on paragraph boundaries", () => {
      const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.\n\nParagraph four.";
      const chunks = chunkText(text, 30);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(60);
      }
    });
  });

  describe("VectorStore", () => {
    it("returns top-k results sorted by similarity", () => {
      const store = new VectorStore();
      store.add({ id: "a-0", sourceId: "a", sourceType: "rule", text: "alpha", embedding: [1, 0, 0] });
      store.add({ id: "b-0", sourceId: "b", sourceType: "rule", text: "beta", embedding: [0, 1, 0] });
      store.add({ id: "c-0", sourceId: "c", sourceType: "reference", text: "gamma", embedding: [0.9, 0.1, 0] });

      const results = store.search([1, 0, 0], 2);
      expect(results).toHaveLength(2);
      expect(results[0].sourceId).toBe("a");
      expect(results[1].sourceId).toBe("c");
    });

    it("returns empty array when store is empty", () => {
      const store = new VectorStore();
      expect(store.search([1, 0, 0], 5)).toEqual([]);
    });
  });
});
