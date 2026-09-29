/**
 * SSC CGL CBT Exam Engine (TCS iON / Testranking Style)
 * DRY + testable + deterministic quiz session generation
 */

const QUESTION_STATUS = {
  NOT_VISITED: 0,
  NOT_ANSWERED: 1,
  ANSWERED: 2,
  MARKED_REVIEW: 3,
  ANSWERED_REVIEW: 4
};

const state = {
  data: null,
  activeCategory: "sports",
  activeQuiz: null,
  currentQuestionIndex: 0,
  userResponses: {},
  questionStatuses: {},
  timerSecondsRemaining: 25 * 60,
  timerInterval: null,
  activeSolutionFilter: "all",
  testHistory: {},
  questionOrder: []
};

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  loadTestHistory();
  setupEventListeners();
  renderDashboard();
});

function loadData() {
  if (window.QUIZ_DATA) {
    state.data = window.QUIZ_DATA;
    renderDashboard();
    return;
  }

  fetch("data/quizzes.json")
    .then(res => res.json())
    .then(data => {
      state.data = data;
      renderDashboard();
    })
    .catch(err => {
      console.error("Failed to load quiz data:", err);
    });
}

function loadTestHistory() {
  try {
    const saved = localStorage.getItem("ssc_cgl_quiz_history");
    state.testHistory = saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.warn("LocalStorage access failed:", e);
  }
}

function saveTestHistory(quizId, score, total) {
  try {
    state.testHistory[quizId] = {
      score,
      total,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("ssc_cgl_quiz_history", JSON.stringify(state.testHistory));
  } catch (e) {
    console.warn("LocalStorage save failed:", e);
  }
}

function setupEventListeners() {
  document.getElementById("btn-save-next").addEventListener("click", handleSaveAndNext);
  document.getElementById("btn-mark-review").addEventListener("click", handleMarkForReviewAndNext);
  document.getElementById("btn-clear-response").addEventListener("click", handleClearResponse);
  document.getElementById("btn-prev").addEventListener("click", handlePrevious);

  document.getElementById("btn-submit-exam").addEventListener("click", openSubmitModal);
  document.getElementById("modal-btn-confirm-submit").addEventListener("click", submitTest);
  document.getElementById("modal-btn-cancel-submit").addEventListener("click", closeSubmitModal);

  document.getElementById("btn-back-to-dash").addEventListener("click", returnToDashboard);
  document.getElementById("btn-reattempt").addEventListener("click", () => {
    if (state.activeQuiz) {
      startQuiz(state.activeQuiz.id, true);
    }
  });

  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", (event) => {
      document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      event.target.classList.add("active");
      state.activeSolutionFilter = event.target.dataset.filter;
      renderSolutions();
    });
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuizSession(quiz, randomizeQuestions = false, randomizeOptions = true) {
  const originalIndexes = Array.from({ length: quiz.questions.length }, (_, index) => index);
  const questionIndexes = randomizeQuestions ? shuffle(originalIndexes) : originalIndexes;

  const questions = questionIndexes.map(originalIndex => {
    const sourceQuestion = quiz.questions[originalIndex];
    const optionIndexes = Array.from({ length: sourceQuestion.options.length }, (_, i) => i);
    const shuffledOptionIndexes = randomizeOptions ? shuffle(optionIndexes) : optionIndexes;

    const shuffledOptions = shuffledOptionIndexes.map(optionIndex => sourceQuestion.options[optionIndex]);
    const correctIndex = shuffledOptionIndexes.indexOf(sourceQuestion.correct);

    return {
      ...sourceQuestion,
      options: shuffledOptions,
      correct: correctIndex,
      originalQuestionIndex: originalIndex
    };
  });

  return {
    questionOrder: questionIndexes,
    questions
  };
}

function buildSessionForAttempt(quiz, isRetake) {
  return buildQuizSession(quiz, isRetake, true);
}

function resetAttemptState(quiz, session) {
  state.activeQuiz = {
    id: quiz.id,
    title: quiz.title,
    category_id: quiz.category_id,
    category_name: quiz.category_name,
    month_name: quiz.month_name,
    time_limit_minutes: quiz.time_limit_minutes,
    questions: session.questions
  };

  state.currentQuestionIndex = 0;
  state.userResponses = {};
  state.questionStatuses = {};
  state.questionOrder = session.questionOrder;

  state.activeQuiz.questions.forEach((_, index) => {
    state.questionStatuses[index] = QUESTION_STATUS.NOT_VISITED;
  });

  state.questionStatuses[0] = QUESTION_STATUS.NOT_ANSWERED;
  state.timerSecondsRemaining = (quiz.time_limit_minutes || 25) * 60;
}

function renderDashboard() {
  if (!state.data) return;

  const categoryGrid = document.getElementById("category-grid");
  categoryGrid.innerHTML = "";

  state.data.categories.forEach(category => {
    const catQuizzes = state.data.months
      .map(month => `${category.id}_${month.id}`)
      .filter(quizId => state.data.quizzes[quizId]);

    const attemptedCount = catQuizzes.filter(quizId => state.testHistory[quizId]).length;

    const card = document.createElement("div");
    card.className = `category-card ${category.id === state.activeCategory ? "active" : ""}`;
    card.onclick = () => selectCategory(category.id);
    card.innerHTML = `
      <div class="category-card-top">
        <div class="category-icon-box" style="background-color: ${category.color}15; color: ${category.color}">
          ${category.icon}
        </div>
        <div class="category-card-info">
          <h3>${category.name}</h3>
          <p>${category.description}</p>
        </div>
      </div>
      <div class="category-quiz-counter">
        <span>7 Monthly Quizzes (175 Qs)</span>
        <span>${attemptedCount > 0 ? `Completed: ${attemptedCount}/7` : "Ready to Start"}</span>
      </div>
    `;
    categoryGrid.appendChild(card);
  });

  renderCategoryQuizzes();
}

function selectCategory(categoryId) {
  state.activeCategory = categoryId;
  document.querySelectorAll(".category-card").forEach(card => card.classList.remove("active"));
  renderDashboard();
}

function renderCategoryQuizzes() {
  const container = document.getElementById("monthly-quizzes-grid");
  const heading = document.getElementById("selected-category-title");
  container.innerHTML = "";

  const currentCategory = state.data.categories.find(category => category.id === state.activeCategory);
  heading.innerHTML = `${currentCategory.icon} ${currentCategory.name} - Monthly SSC CGL Quizzes`;

  state.data.months.forEach(month => {
    const quizId = `${state.activeCategory}_${month.id}`;
    const quiz = state.data.quizzes[quizId];
    if (!quiz) return;

    const history = state.testHistory[quizId];

    const card = document.createElement("div");
    card.className = "quiz-item-card";
    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h4 class="quiz-month-title">${quiz.title}</h4>
          ${history ? `<span class="score-badge">Score: ${history.score.toFixed(1)} / 50</span>` : ""}
        </div>
        <div class="quiz-item-meta">
          <span>📝 <strong>25 Questions</strong> (Multiple Choice)</span>
          <span>⏱️ <strong>25 Minutes</strong> Time Limit</span>
          <span>🎯 <strong>50 Marks</strong> (+2.00 / -0.50 Marking)</span>
          <span>📅 Focus: <strong>${month.name}</strong></span>
        </div>
      </div>
      <button type="button" class="btn-start-test" onclick="window.startQuiz('${quizId}')">
        ${history ? "Re-take Quiz" : "Start Test"} ➔
      </button>
    `;
    container.appendChild(card);
  });
}

function startQuiz(quizId, isRetake = false) {
  const quiz = state.data.quizzes[quizId];
  if (!quiz) return;

  const session = buildSessionForAttempt(quiz, isRetake);
  resetAttemptState(quiz, session);

  startTimer();

  document.getElementById("dashboard-view").style.display = "none";
  document.getElementById("result-view").classList.remove("active");
  document.getElementById("result-view").style.display = "none";

  const examView = document.getElementById("exam-active-view");
  examView.style.display = "flex";
  examView.classList.add("active");
  document.getElementById("exam-header-timer").style.display = "flex";
  window.scrollTo({ top: 0, behavior: "smooth" });

  document.getElementById("exam-header-title").textContent = quiz.title;
  document.getElementById("exam-header-subtitle").textContent = "SSC CGL (Tier-1) - General Awareness CBT Mock";
  document.getElementById("section-display-tag").textContent = `${state.data.categories.find(c => c.id === quiz.category_id)?.name} (${quiz.month_name})`;

  renderQuestion();
  renderPalette();
}

function startTimer() {
  clearInterval(state.timerInterval);
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.timerSecondsRemaining -= 1;
    updateTimerDisplay();

    if (state.timerSecondsRemaining <= 0) {
      clearInterval(state.timerInterval);
      alert("Time is up! Your test will now be submitted automatically.");
      submitTest();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(state.timerSecondsRemaining / 60);
  const secs = state.timerSecondsRemaining % 60;
  const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const timerElem = document.getElementById("time-left-display");
  const timerBox = document.getElementById("timer-container");
  timerElem.textContent = formatted;

  timerBox.classList.toggle("warning", state.timerSecondsRemaining <= 300);
}

function getCurrentQuestion() {
  return state.activeQuiz.questions[state.currentQuestionIndex];
}

function isQuestionAnswered(questionIndex) {
  const value = state.userResponses[questionIndex];
  return value !== undefined && value !== null;
}

function setQuestionStatusByAnswer(questionIndex) {
  const hasAnswer = isQuestionAnswered(questionIndex);
  state.questionStatuses[questionIndex] = hasAnswer ? QUESTION_STATUS.ANSWERED : QUESTION_STATUS.NOT_ANSWERED;
}

function renderQuestion() {
  const question = getCurrentQuestion();
  const qNum = state.currentQuestionIndex + 1;

  document.getElementById("question-number-display").textContent = `Question ${qNum} of ${state.activeQuiz.questions.length}`;
  document.getElementById("question-text-area").textContent = question.question;

  const optionsContainer = document.getElementById("options-container");
  optionsContainer.innerHTML = "";

  const optionLetters = ["A", "B", "C", "D"];
  const currentSelection = state.userResponses[state.currentQuestionIndex];

  question.options.forEach((optionText, optionIndex) => {
    const row = document.createElement("div");
    row.className = `option-row ${currentSelection === optionIndex ? "selected" : ""}`;
    row.onclick = () => selectOption(optionIndex);

    row.innerHTML = `
      <input type="radio" name="cbt_option" class="option-radio" id="opt_${optionIndex}" ${currentSelection === optionIndex ? "checked" : ""}>
      <label class="option-label" for="opt_${optionIndex}">
        <span class="option-index-badge">(${optionLetters[optionIndex]})</span>
        <span>${optionText}</span>
      </label>
    `;

    optionsContainer.appendChild(row);
  });

  document.querySelectorAll(".q-btn").forEach((btn, idx) => {
    btn.classList.toggle("active", idx === state.currentQuestionIndex);
  });
}

function selectOption(optionIndex) {
  state.userResponses[state.currentQuestionIndex] = optionIndex;
  setQuestionStatusByAnswer(state.currentQuestionIndex);
  renderQuestion();
  renderPalette();
}

function handleSaveAndNext() {
  const currentIndex = state.currentQuestionIndex;
  setQuestionStatusByAnswer(currentIndex);
  advanceToNextQuestion();
}

function handleMarkForReviewAndNext() {
  const currentIndex = state.currentQuestionIndex;
  const hasAnswer = isQuestionAnswered(currentIndex);
  state.questionStatuses[currentIndex] = hasAnswer
    ? QUESTION_STATUS.ANSWERED_REVIEW
    : QUESTION_STATUS.MARKED_REVIEW;

  advanceToNextQuestion();
}

function handleClearResponse() {
  const currentIndex = state.currentQuestionIndex;
  delete state.userResponses[currentIndex];
  state.questionStatuses[currentIndex] = QUESTION_STATUS.NOT_ANSWERED;
  renderQuestion();
  renderPalette();
}

function handlePrevious() {
  if (state.currentQuestionIndex > 0) {
    navigateToQuestion(state.currentQuestionIndex - 1);
  }
}

function advanceToNextQuestion() {
  if (state.currentQuestionIndex < state.activeQuiz.questions.length - 1) {
    navigateToQuestion(state.currentQuestionIndex + 1);
    return;
  }

  renderPalette();
  openSubmitModal();
}

function navigateToQuestion(newIndex) {
  const currentIndex = state.currentQuestionIndex;

  if (state.questionStatuses[currentIndex] === QUESTION_STATUS.NOT_VISITED || state.questionStatuses[currentIndex] === QUESTION_STATUS.NOT_ANSWERED) {
    if (!isQuestionAnswered(currentIndex)) {
      state.questionStatuses[currentIndex] = QUESTION_STATUS.NOT_ANSWERED;
    }
  }

  state.currentQuestionIndex = newIndex;

  if (state.questionStatuses[newIndex] === QUESTION_STATUS.NOT_VISITED) {
    state.questionStatuses[newIndex] = QUESTION_STATUS.NOT_ANSWERED;
  }

  renderQuestion();
  renderPalette();
}

function renderPalette() {
  const container = document.getElementById("question-buttons-grid");
  container.innerHTML = "";

  const counts = {
    notVisited: 0,
    notAnswered: 0,
    answered: 0,
    markedReview: 0,
    ansMarkedReview: 0
  };

  const total = state.activeQuiz.questions.length;

  for (let index = 0; index < total; index++) {
    const status = state.questionStatuses[index] || QUESTION_STATUS.NOT_VISITED;
    const btn = document.createElement("button");
    btn.textContent = index + 1;
    btn.onclick = () => navigateToQuestion(index);

    let className = "q-btn ";
    if (index === state.currentQuestionIndex) className += "active ";

    switch (status) {
      case QUESTION_STATUS.NOT_VISITED:
        className += "not-visited";
        counts.notVisited++;
        break;
      case QUESTION_STATUS.NOT_ANSWERED:
        className += "not-answered";
        counts.notAnswered++;
        break;
      case QUESTION_STATUS.ANSWERED:
        className += "answered";
        counts.answered++;
        break;
      case QUESTION_STATUS.MARKED_REVIEW:
        className += "marked-review";
        counts.markedReview++;
        break;
      case QUESTION_STATUS.ANSWERED_REVIEW:
        className += "ans-marked-review";
        counts.ansMarkedReview++;
        break;
      default:
        className += "not-visited";
        counts.notVisited++;
    }

    btn.className = className;
    container.appendChild(btn);
  }

  document.getElementById("cnt-not-visited").textContent = counts.notVisited;
  document.getElementById("cnt-not-answered").textContent = counts.notAnswered;
  document.getElementById("cnt-answered").textContent = counts.answered;
  document.getElementById("cnt-marked-review").textContent = counts.markedReview;
  document.getElementById("cnt-ans-marked-review").textContent = counts.ansMarkedReview;
}

function openSubmitModal() {
  const total = state.activeQuiz.questions.length;
  let ans = 0;
  let notAns = 0;
  let rev = 0;
  let ansRev = 0;
  let notVis = 0;

  for (let index = 0; index < total; index++) {
    const status = state.questionStatuses[index] || QUESTION_STATUS.NOT_VISITED;

    if (status === QUESTION_STATUS.ANSWERED) ans++;
    else if (status === QUESTION_STATUS.NOT_ANSWERED) notAns++;
    else if (status === QUESTION_STATUS.MARKED_REVIEW) rev++;
    else if (status === QUESTION_STATUS.ANSWERED_REVIEW) ansRev++;
    else notVis++;
  }

  document.getElementById("modal-val-total").textContent = total;
  document.getElementById("modal-val-ans").textContent = ans;
  document.getElementById("modal-val-not-ans").textContent = notAns;
  document.getElementById("modal-val-rev").textContent = rev;
  document.getElementById("modal-val-ans-rev").textContent = ansRev;
  document.getElementById("modal-val-not-vis").textContent = notVis;

  document.getElementById("submission-modal").classList.add("active");
}

function closeSubmitModal() {
  document.getElementById("submission-modal").classList.remove("active");
}

function isQuestionEvaluated(questionIndex) {
  const status = state.questionStatuses[questionIndex];
  const answer = state.userResponses[questionIndex];
  return (status === QUESTION_STATUS.ANSWERED || status === QUESTION_STATUS.ANSWERED_REVIEW) && answer !== undefined && answer !== null;
}

function submitTest() {
  closeSubmitModal();
  clearInterval(state.timerInterval);

  const quiz = state.activeQuiz;
  const questions = quiz.questions;

  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  questions.forEach((question, index) => {
    const userAnswer = state.userResponses[index];

    if (isQuestionEvaluated(index)) {
      if (userAnswer === question.correct) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    } else {
      unattemptedCount++;
    }
  });

  const correctMarks = correctCount * 2.0;
  const negativeMarks = incorrectCount * 0.5;
  const totalScore = Math.max(0, correctMarks - negativeMarks);
  const attemptedCount = correctCount + incorrectCount;
  const accuracy = attemptedCount > 0 ? ((correctCount / attemptedCount) * 100).toFixed(1) : 0;

  saveTestHistory(quiz.id, totalScore, 50.0);

  document.getElementById("exam-active-view").classList.remove("active");
  document.getElementById("exam-active-view").style.display = "none";
  document.getElementById("exam-header-timer").style.display = "none";

  const resultView = document.getElementById("result-view");
  resultView.classList.add("active");
  resultView.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });

  document.getElementById("res-quiz-title").textContent = quiz.title;
  document.getElementById("res-total-score").textContent = `${totalScore.toFixed(2)} / 50.0`;
  document.getElementById("res-accuracy").textContent = `${accuracy}%`;
  document.getElementById("res-attempted").textContent = `${attemptedCount} / ${questions.length}`;
  document.getElementById("res-correct").textContent = correctCount;
  document.getElementById("res-incorrect").textContent = incorrectCount;
  document.getElementById("res-unattempted").textContent = unattemptedCount;

  renderSolutions();
}

function renderSolutions() {
  const container = document.getElementById("solutions-list");
  container.innerHTML = "";

  const quiz = state.activeQuiz;
  if (!quiz) return;

  const optionLetters = ["A", "B", "C", "D"];

  let corr = 0;
  let incorr = 0;
  let unatt = 0;

  quiz.questions.forEach((question, index) => {
    const userAnswer = state.userResponses[index];
    const status = state.questionStatuses[index];
    const evaluated = isQuestionEvaluated(index);

    if (evaluated) {
      if (userAnswer === question.correct) corr++;
      else incorr++;
    } else {
      unatt++;
    }
  });

  const tabAll = document.querySelector('.filter-tab[data-filter="all"]');
  const tabCorrect = document.querySelector('.filter-tab[data-filter="correct"]');
  const tabIncorrect = document.querySelector('.filter-tab[data-filter="incorrect"]');
  const tabUnattempted = document.querySelector('.filter-tab[data-filter="unattempted"]');

  if (tabAll) tabAll.textContent = `All Questions (${quiz.questions.length})`;
  if (tabCorrect) tabCorrect.textContent = `✔ Correct (${corr})`;
  if (tabIncorrect) tabIncorrect.textContent = `❌ Incorrect (${incorr})`;
  if (tabUnattempted) tabUnattempted.textContent = `⚪ Unattempted (${unatt})`;

  quiz.questions.forEach((question, index) => {
    const userAnswer = state.userResponses[index];
    const evaluated = isQuestionEvaluated(index);

    let evalStatus = "unattempted";
    if (evaluated) {
      evalStatus = userAnswer === question.correct ? "correct" : "incorrect";
    }

    if (state.activeSolutionFilter !== "all" && state.activeSolutionFilter !== evalStatus) {
      return;
    }

    const card = document.createElement("div");
    card.className = `solution-card status-${evalStatus}`;

    let statusBadgeText = "⚪ Unattempted (0 Marks)";
    if (evalStatus === "correct") statusBadgeText = "🟢 Correct (+2.00 Marks)";
    if (evalStatus === "incorrect") statusBadgeText = "🔴 Incorrect (-0.50 Marks)";

    card.innerHTML = `
      <div class="solution-header">
        <span>Question ${index + 1}</span>
        <span>${statusBadgeText}</span>
      </div>
      <div class="solution-question-text">${question.question}</div>
      <div class="solution-options-list">
        ${question.options.map((optionText, optionIndex) => {
          let className = "sol-opt";
          let icon = "";

          if (optionIndex === question.correct) {
            className += " correct-answer";
            icon = " ✔ [Correct Answer]";
          }

          if (evaluated && userAnswer === optionIndex && userAnswer !== question.correct) {
            className += " user-wrong";
            icon = " ✖ [Your Selection]";
          } else if (evaluated && userAnswer === optionIndex && userAnswer === question.correct) {
            icon += " (Your Selection)";
          }

          return `<div class="${className}"><strong>(${optionLetters[optionIndex]})</strong> ${optionText}${icon}</div>`;
        }).join("")}
      </div>
      <div class="explanation-box">
        <strong>💡 Rationale & Key SSC Facts:</strong><br>
        ${question.explanation}
      </div>
    `;

    container.appendChild(card);
  });
}

function returnToDashboard() {
  const examView = document.getElementById("exam-active-view");
  examView.classList.remove("active");
  examView.style.display = "none";

  const resultView = document.getElementById("result-view");
  resultView.classList.remove("active");
  resultView.style.display = "none";

  document.getElementById("exam-header-timer").style.display = "none";

  const dashboardView = document.getElementById("dashboard-view");
  dashboardView.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });

  document.getElementById("exam-header-title").textContent = "SSC CGL CBT Examination Simulator";
  document.getElementById("exam-header-subtitle").textContent = "General Awareness - Current Affairs Monthly Modules";

  renderDashboard();
}

window.startQuiz = startQuiz;
window.selectCategory = selectCategory;
window.handleSaveAndNext = handleSaveAndNext;
window.handleMarkForReviewAndNext = handleMarkForReviewAndNext;
window.handleClearResponse = handleClearResponse;
window.handlePrevious = handlePrevious;
window.navigateToQuestion = navigateToQuestion;
window.submitTest = submitTest;
window.returnToDashboard = returnToDashboard;

function reattemptQuiz() {
  if (state.activeQuiz) {
    if (confirm("Would you like to restart this quiz from Question 1? Your timer and responses will be reset. Questions and answer options will be randomly shuffled.")) {
      startQuiz(state.activeQuiz.id, true);
    }
  } else {
    returnToDashboard();
  }
}

window.reattemptQuiz = reattemptQuiz;
