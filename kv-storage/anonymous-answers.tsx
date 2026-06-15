type AnonymousAnswer = {
  question_id: number
  answer: boolean | null
  public: boolean
};

let anonymousAnswers: AnonymousAnswer[] = [];

const loadAnonymousAnswers = (): AnonymousAnswer[] => anonymousAnswers;

const addAnonymousAnswer = (answer: AnonymousAnswer): AnonymousAnswer[] => {
  anonymousAnswers = [
    ...anonymousAnswers.filter(a => a.question_id !== answer.question_id),
    answer,
  ];
  return anonymousAnswers;
};

const removeAnonymousAnswer = (questionId: number): AnonymousAnswer[] => {
  anonymousAnswers = anonymousAnswers.filter(a => a.question_id !== questionId);
  return anonymousAnswers;
};

const clearAnonymousAnswers = (): void => {
  anonymousAnswers = [];
};

export {
  AnonymousAnswer,
  loadAnonymousAnswers,
  addAnonymousAnswer,
  removeAnonymousAnswer,
  clearAnonymousAnswers,
};
