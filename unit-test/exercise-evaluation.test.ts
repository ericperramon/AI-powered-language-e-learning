import { describe, expect, it } from "vitest";
import { correctExerciseAnswer, getAcceptedAnswers } from "@/lib/exercises/evaluation";

describe("exercise evaluation", () => {
  it("accepts a simple configured answer", () => {
    const result = correctExerciseAnswer({ answer: "Bonjour" }, " bonjour ");

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("accepts one answer from an accepted answers list", () => {
    const result = correctExerciseAnswer({ acceptedAnswers: ["hello", "hi"] }, "Hi");

    expect(result.passed).toBe(true);
  });

  it("normalizes accents and trailing punctuation", () => {
    const result = correctExerciseAnswer({ correct_answer: "cafe" }, "Café!");

    expect(result.passed).toBe(true);
  });

  it("extracts answers from option-like objects", () => {
    expect(getAcceptedAnswers({ answers: [{ value: "a" }, { text: "b" }] })).toEqual(["a", "b"]);
  });

  it("keeps unanswered freeform exercises pending when no correction exists", () => {
    const result = correctExerciseAnswer(null, "");

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it("corrects multiple choice tests with one answer per item", () => {
    const result = correctExerciseAnswer(
      {
        answers: [
          { answer: "a", question_id: "q_1" },
          { answer: "b", question_id: "q_2" }
        ]
      },
      { answers: { q_1: "a", q_2: "b" } }
    );

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("scores partially correct multiple choice tests", () => {
    const result = correctExerciseAnswer(
      {
        answers: [
          { answer: "a", question_id: "q_1" },
          { answer: "b", question_id: "q_2" }
        ]
      },
      { answers: { q_1: "a", q_2: "c" } }
    );

    expect(result.passed).toBe(false);
    expect(result.score).toBe(50);
    expect(result.incorrectAnswers).toEqual([
      {
        itemId: "q_2",
        submittedAnswer: "c",
        correctAnswer: "b",
        correctText: null
      }
    ]);
  });

  it("corrects multiple choice blanks keyed by blank_id", () => {
    const result = correctExerciseAnswer(
      {
        answers: [
          { answer: "b", blank_id: "blank_1", text: "upmarket" },
          { answer: "a", blank_id: "blank_2", text: "leader" }
        ]
      },
      { answers: { blank_1: "b", blank_2: "a" } }
    );

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("returns corrections for blanks with a non-perfect score", () => {
    const result = correctExerciseAnswer(
      {
        answers: [
          { answer: "b", blank_id: "blank_1", text: "upmarket" },
          { answer: "a", blank_id: "blank_2", text: "leader" }
        ]
      },
      { answers: { blank_1: "c", blank_2: "a" } }
    );

    expect(result.score).toBe(50);
    expect(result.incorrectAnswers).toEqual([
      {
        itemId: "blank_1",
        submittedAnswer: "c",
        correctAnswer: "b",
        correctText: "upmarket"
      }
    ]);
  });

  it("records a freeform answer as passed when no correct answer is configured", () => {
    const result = correctExerciseAnswer(null, "Cualquier respuesta");

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.feedback).toBe("Answer recorded.");
  });

  describe("flat questions-map format", () => {
    it("accepts a flat map with string and array values regardless of order", () => {
      const result = correctExerciseAnswer(
        { q1: "Nova Solutions Ltd", q3: ["results-driven", "ambitious"] },
        { answers: { q1: " nova solutions ltd ", q3: ["ambitious", "results-driven"] } }
      );

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it("scores a flat map partially and reports the failing key", () => {
      const result = correctExerciseAnswer(
        { q1: "Nova Solutions Ltd", q3: ["results-driven", "ambitious"] },
        { answers: { q1: "Wrong Company", q3: ["ambitious", "results-driven"] } }
      );

      expect(result.passed).toBe(false);
      expect(result.score).toBe(50);
      expect(result.incorrectAnswers).toEqual([
        {
          itemId: "q1",
          submittedAnswer: "Wrong Company",
          correctAnswer: "Nova Solutions Ltd",
          correctText: "Nova Solutions Ltd"
        }
      ]);
    });

    it("marks an array answer wrong when a selected option is missing", () => {
      const result = correctExerciseAnswer(
        { q3: ["results-driven", "ambitious"] },
        { answers: { q3: ["ambitious"] } }
      );

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.incorrectAnswers[0]).toMatchObject({ itemId: "q3" });
    });
  });

  describe("getAcceptedAnswers shapes", () => {
    it("reads the singular correctAnswer field", () => {
      expect(getAcceptedAnswers({ correctAnswer: "yes" })).toEqual(["yes"]);
    });

    it("coerces numeric values to strings", () => {
      expect(getAcceptedAnswers({ value: 42 })).toEqual(["42"]);
    });

    it("reads snake_case accepted_answers arrays", () => {
      expect(getAcceptedAnswers({ accepted_answers: ["a", "b"] })).toEqual(["a", "b"]);
    });

    it("returns an empty list when nothing is configured", () => {
      expect(getAcceptedAnswers(null)).toEqual([]);
      expect(getAcceptedAnswers({})).toEqual([]);
    });
  });
});
