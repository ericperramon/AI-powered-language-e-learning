export type ExerciseCorrection = {
  passed: boolean;
  score: number;
  feedback: string;
  expectedAnswer: string | null;
  incorrectAnswers: IncorrectAnswer[];
};

type JsonMap = Record<string, unknown>;
type ExerciseAnswer = string | JsonMap;
type IncorrectAnswer = {
  itemId: string;
  submittedAnswer: string;
  correctAnswer: string;
  correctText: string | null;
};

export function correctExerciseAnswer(correctAnswerJson: JsonMap | null, rawAnswer: ExerciseAnswer): ExerciseCorrection {
  const questionsMapCorrection = correctQuestionsMapAnswer(correctAnswerJson, rawAnswer);
  if (questionsMapCorrection) return questionsMapCorrection;

  const multiQuestionCorrection = correctMultiQuestionAnswer(correctAnswerJson, rawAnswer);
  if (multiQuestionCorrection) return multiQuestionCorrection;

  const rawTextAnswer = typeof rawAnswer === "string" ? rawAnswer : readAnswerValue(rawAnswer.answer)[0] ?? "";
  const answer = normalizeAnswer(rawTextAnswer);
  const acceptedAnswers = getAcceptedAnswers(correctAnswerJson);

  if (acceptedAnswers.length === 0) {
    return {
      passed: Boolean(answer),
      score: answer ? 100 : 0,
      feedback: answer ? "Answer recorded." : "Add an answer before continuing.",
      expectedAnswer: null,
      incorrectAnswers: []
    };
  }

  const passed = acceptedAnswers.some((acceptedAnswer) => normalizeAnswer(acceptedAnswer) === answer);

  return {
    passed,
    score: passed ? 100 : 0,
    feedback: passed ? "Correct answer." : "Review the answer and try again.",
    expectedAnswer: acceptedAnswers[0] ?? null,
    incorrectAnswers: passed
      ? []
      : [
          {
            itemId: "answer",
            submittedAnswer: rawTextAnswer,
            correctAnswer: acceptedAnswers[0] ?? "",
            correctText: acceptedAnswers[0] ?? null
          }
        ]
  };
}

function correctMultiQuestionAnswer(
  correctAnswerJson: JsonMap | null,
  rawAnswer: ExerciseAnswer
): ExerciseCorrection | null {
  if (!correctAnswerJson || typeof rawAnswer === "string" || !isJsonMap(rawAnswer)) {
    return null;
  }

  const expectedAnswers = readExpectedQuestionAnswers(correctAnswerJson.answers);

  if (expectedAnswers.length === 0) {
    return null;
  }

  const submittedAnswers = isJsonMap(rawAnswer.answers) ? rawAnswer.answers : rawAnswer;
  let correctCount = 0;
  const incorrectAnswers: IncorrectAnswer[] = [];

  for (const expectedAnswer of expectedAnswers) {
    const submittedAnswer = submittedAnswers[expectedAnswer.questionId];

    if (typeof submittedAnswer === "string" && normalizeAnswer(submittedAnswer) === normalizeAnswer(expectedAnswer.answer)) {
      correctCount += 1;
    } else {
      incorrectAnswers.push({
        itemId: expectedAnswer.questionId,
        submittedAnswer: typeof submittedAnswer === "string" ? submittedAnswer : "",
        correctAnswer: expectedAnswer.answer,
        correctText: expectedAnswer.text
      });
    }
  }

  const score = Math.round((correctCount / expectedAnswers.length) * 100);

  return {
    passed: correctCount === expectedAnswers.length,
    score,
    feedback:
      correctCount === expectedAnswers.length
        ? "Correct answers."
        : `${correctCount} of ${expectedAnswers.length} answers are correct. Review the marked questions and try again.`,
    expectedAnswer: expectedAnswers.map((answer) => `${answer.questionId}: ${answer.answer}`).join(", "),
    incorrectAnswers
  };
}

function readExpectedQuestionAnswers(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isJsonMap(item)) {
      return [];
    }

    const questionId = item.question_id ?? item.questionId ?? item.blank_id ?? item.blankId ?? item.id;
    const answer = item.answer ?? item.correctAnswer ?? item.correct_answer ?? item.value;
    const text = item.text;

    if (typeof questionId === "string" && typeof answer === "string") {
      return [{ questionId, answer, text: typeof text === "string" ? text : null }];
    }

    return [];
  });
}

export function getAcceptedAnswers(correctAnswerJson: JsonMap | null): string[] {
  if (!correctAnswerJson) {
    return [];
  }

  const candidates = [
    correctAnswerJson.answer,
    correctAnswerJson.correctAnswer,
    correctAnswerJson.correct_answer,
    correctAnswerJson.value,
    correctAnswerJson.text,
    correctAnswerJson.answers,
    correctAnswerJson.acceptedAnswers,
    correctAnswerJson.accepted_answers
  ];

  return candidates.flatMap(readAnswerValue).filter((answer) => answer.length > 0);
}

function readAnswerValue(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap(readAnswerValue);
  }

  if (isJsonMap(value)) {
    return readAnswerValue(value.value ?? value.text ?? value.label ?? value.answer);
  }

  return [];
}

// Handles correct_answer_json as a flat map of question IDs:
// { "q1": "Nova Solutions Ltd", "q3": ["results-driven", "ambitious"] }
function correctQuestionsMapAnswer(
  correctAnswerJson: JsonMap | null,
  rawAnswer: ExerciseAnswer
): ExerciseCorrection | null {
  if (!correctAnswerJson || typeof rawAnswer === "string" || !isJsonMap(rawAnswer)) return null;

  const submitted = rawAnswer.answers;
  if (!isJsonMap(submitted)) return null;

  // Must not be the existing { answers: [...] } array format
  if (Array.isArray(correctAnswerJson.answers)) return null;

  const entries = Object.entries(correctAnswerJson);
  if (entries.length === 0) return null;

  let correctCount = 0;
  const incorrectAnswers: IncorrectAnswer[] = [];

  for (const [questionId, correctValue] of entries) {
    const submittedValue = submitted[questionId];

    if (Array.isArray(correctValue)) {
      const sortedCorrect = [...correctValue].map((v) => normalizeAnswer(String(v))).sort();
      const sortedSubmitted = Array.isArray(submittedValue)
        ? submittedValue.map((v) => normalizeAnswer(String(v))).sort()
        : [];
      const isCorrect = JSON.stringify(sortedCorrect) === JSON.stringify(sortedSubmitted);
      if (isCorrect) {
        correctCount++;
      } else {
        incorrectAnswers.push({
          itemId: questionId,
          submittedAnswer: Array.isArray(submittedValue) ? submittedValue.join(", ") : "",
          correctAnswer: correctValue.join(", "),
          correctText: correctValue.join(", ")
        });
      }
    } else {
      const isCorrect =
        normalizeAnswer(String(correctValue)) ===
        normalizeAnswer(typeof submittedValue === "string" ? submittedValue : "");
      if (isCorrect) {
        correctCount++;
      } else {
        incorrectAnswers.push({
          itemId: questionId,
          submittedAnswer: typeof submittedValue === "string" ? submittedValue : "",
          correctAnswer: String(correctValue),
          correctText: String(correctValue)
        });
      }
    }
  }

  const total = entries.length;
  const score = Math.round((correctCount / total) * 100);

  return {
    passed: correctCount === total,
    score,
    feedback:
      correctCount === total
        ? "All answers correct!"
        : `${correctCount} of ${total} correct. Review the marked questions and try again.`,
    expectedAnswer: entries
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join(" | "),
    incorrectAnswers
  };
}

function isJsonMap(value: unknown): value is JsonMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAnswer(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}
