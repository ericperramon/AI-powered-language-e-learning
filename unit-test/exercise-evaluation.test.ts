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
});
