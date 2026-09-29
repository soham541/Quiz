/**
 * SSC CGL CBT Exam Engine (TCS iON / Testranking Style)
 */

// Application State
const state = {
  data: null,
  activeCategory: "sports",
  activeQuiz: null,
  currentQuestionIndex: 0,
  userResponses: {}, // qIndex: optionIndex (0-3 or null)
  questionStatuses: {}, // qIndex: 0 (not-visited), 1 (not-answered), 2 (answered), 3 (marked-review), 4 (ans-marked-review)
  timerSecondsRemaining: 25 * 60,
  timerInterval: null,
  isReviewMode: false,
  activeSolutionFilter: "all",
  testHistory: {},
  questionOrder: []
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  loadTestHistory();
  setupEventListeners();
  renderDashboard();
});

function loadData() {
  if (window.QUIZ_DATA) {
    state.data = window.QUIZ_DATA;
  } else {
    fetch("data/quizzes.json")
      .then(res => res.json())
      .then(d => {
        state.data = d;
        renderDashboard();
      })
      .catch(err => {
        console.error("Failed to load quiz data:", err);
      });
  }
}

function loadTestHistory() {
  try {
    const saved = localStorage.getItem("ssc_cgl_quiz_history");
    if (saved) {
      state.testHistory = JSON.parse(saved);
    }
  } catch (e) {
    console.warn("LocalStorage access failed:", e);
  }
}

function saveTestHistory(quizId, score, total) {
  try {
    state.testHistory[quizId] = {
      score: score,
      total: total,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("ssc_cgl_quiz_history", JSON.stringify(state.testHistory));
  } catch (e) {
    console.warn("LocalStorage save failed:", e);
  }
}

function setupEventListeners() {
  // Navigation actions in Exam
  document.getElementById("btn-save-next").addEventListener("click", handleSaveAndNext);
  document.getElementById("btn-mark-review").addEventListener("click", handleMarkForReviewAndNext);
  document.getElementById("btn-clear-response").addEventListener("click", handleClearResponse);
  document.getElementById("btn-prev").addEventListener("click", handlePrevious);

  // Submit actions
  document.getElementById("btn-submit-exam").addEventListener("click", openSubmitModal);
  document.getElementById("modal-btn-confirm-submit").addEventListener("click", submitTest);
  document.getElementById("modal-btn-cancel-submit").addEventListener("click", closeSubmitModal);

  // Back to dashboard
  document.getElementById("btn-back-to-dash").addEventListener("click", returnToDashboard);
  document.getElementById("btn-reattempt").addEventListener("click", () => {
    if (state.activeQuiz) {
      startQuiz(state.activeQuiz.id, true);
    }
  });

  // Solution filters
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
      state.activeSolutionFilter = e.target.dataset.filter;
      renderSolutions();
    });
  });
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRandomizedQuizSession(quiz, randomizeQuestions, randomizeOptions) {
  const originalOrder = Array.from({ length: quiz.questions.length }, (_, idx) => idx);
  const questionOrder = randomizeQuestions ? shuffleArray(originalOrder) : originalOrder;

  const randomizedQuestions = questionOrder.map((originalIndex) => {
    const sourceQuestion = quiz.questions[originalIndex];
    const optionOrder = randomizeOptions ? shuffleArray(Array.from({ length: sourceQuestion.options.length }, (_, idx) => idx)) : Array.from({ length: sourceQuestion.options.length }, (_, idx) => idx);

    const shuffledOptions = optionOrder.map(optIndex => sourceQuestion.options[optIndex]);
    const shuffledCorrectIndex = optionOrder.indexOf(sourceQuestion.correct);

    return {
      ...sourceQuestion,
      options: shuffledOptions,
      correct: shuffledCorrectIndex,
      originalQuestionIndex: originalIndex
    };
  });

  return {
    questionOrder,
    questions: randomizedQuestions
  };
}

// --------------------------------------------------------------------------
// Dashboard Rendering
// --------------------------------------------------------------------------
function renderDashboard() {
  if (!state.data) return;

  // Render Category Cards
  const catContainer = document.getElementById("category-grid");
  catContainer.innerHTML = "";

  state.data.categories.forEach(cat => {
    const card = document.createElement("div");
    card.className = `category-card ${cat.id === state.activeCategory ? "active" : ""}`;
    card.onclick = () => selectCategory(cat.id);

    // Count quizzes in this category
    const catQuizzes = state.data.months.map(m => `${cat.id}_${m.id}`).filter(id => state.data.quizzes[id]);
    const attemptedCount = catQuizzes.filter(id => state.testHistory[id]).length;

    card.innerHTML = `
      <div class="category-card-top">
        <div class="category-icon-box" style="background-color: ${cat.color}15; color: ${cat.color}">
          ${cat.icon}
        </div>
        <div class="category-card-info">
          <h3>${cat.name}</h3>
          <p>${cat.description}</p>
        </div>
      </div>
      <div class="category-quiz-counter">
        <span>7 Monthly Quizzes (175 Qs)</span>
        <span>${attemptedCount > 0 ? `Completed: ${attemptedCount}/7` : 'Ready to Start'}</span>
      </div>
    `;
    catContainer.appendChild(card);
  });

  renderCategoryQuizzes();
}

function selectCategory(catId) {
  state.activeCategory = catId;
  document.querySelectorAll(".category-card").forEach(c => c.classList.remove("active"));
  renderDashboard();
}

function renderCategoryQuizzes() {
  const container = document.getElementById("monthly-quizzes-grid");
  const heading = document.getElementById("selected-category-title");
  container.innerHTML = "";

  const currentCat = state.data.categories.find(c => c.id === state.activeCategory);
  heading.innerHTML = `${currentCat.icon} ${currentCat.name} - Monthly SSC CGL Quizzes`;

  state.data.months.forEach((m, idx) => {
    const quizId = `${state.activeCategory}_${m.id}`;
    const quiz = state.data.quizzes[quizId];
    if (!quiz) return;

    const history = state.testHistory[quizId];

    const card = document.createElement("div");
    card.className = "quiz-item-card";
    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h4 class="quiz-month-title">${quiz.title}</h4>
          ${history ? `<span class="score-badge">Score: ${history.score.toFixed(1)} / 50</span>` : ''}
        </div>
        <div class="quiz-item-meta">
          <span>📝 <strong>25 Questions</strong> (Multiple Choice)</span>
          <span>⏱️ <strong>25 Minutes</strong> Time Limit</span>
          <span>🎯 <strong>50 Marks</strong> (+2.00 / -0.50 Marking)</span>
          <span>📅 Focus: <strong>${m.name}</strong></span>
        </div>
      </div>
      <button type="button" class="btn-start-test" onclick="window.startQuiz('${quizId}')">
        ${history ? 'Re-take Quiz' : 'Start Test'} ➔
      </button>
    `;
    container.appendChild(card);
  });
}

// --------------------------------------------------------------------------
// CBT Examination Engine
// --------------------------------------------------------------------------
function startQuiz(quizId, isRetake = false) {
  const quiz = state.data.quizzes[quizId];
  if (!quiz) return;

  // Always randomize options for variety, randomize questions only on retake
  const randomSession = buildRandomizedQuizSession(quiz, isRetake, true);

  state.activeQuiz = {
    ...quiz,
    questions: randomSession.questions
  };

  state.currentQuestionIndex = 0;
  state.userResponses = {};
  state.questionStatuses = {};
  state.questionOrder = randomSession.questionOrder;

  // Initialize all questions as Not Visited (0)
  for (let i = 0; i < state.activeQuiz.questions.length; i++) {
    state.questionStatuses[i] = 0;
  }
  // Current question is now visited but not answered (1)
  state.questionStatuses[0] = 1;

  // Setup timer
  state.timerSecondsRemaining = (quiz.time_limit_minutes || 25) * 60;
  startTimer();

  // Switch View
  document.getElementById("dashboard-view").style.display = "none";
  document.getElementById("result-view").classList.remove("active");
  document.getElementById("result-view").style.display = "none";
  const examView = document.getElementById("exam-active-view");
  examView.style.display = "flex";
  examView.classList.add("active");
  document.getElementById("exam-header-timer").style.display = "flex";
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update Exam Titles
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
    state.timerSecondsRemaining--;
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

  if (state.timerSecondsRemaining <= 300) {
    timerBox.classList.add("warning");
  } else {
    timerBox.classList.remove("warning");
  }
}

function renderQuestion() {
  const quiz = state.activeQuiz;
  const q = quiz.questions[state.currentQuestionIndex];
  const qNum = state.currentQuestionIndex + 1;

  document.getElementById("question-number-display").textContent = `Question ${qNum} of ${quiz.questions.length}`;
  document.getElementById("question-text-area").textContent = q.question;

  const optionsContainer = document.getElementById("options-container");
  optionsContainer.innerHTML = "";

  const optionLetters = ["A", "B", "C", "D"];
  const currentSelection = state.userResponses[state.currentQuestionIndex];

  q.options.forEach((optText, optIdx) => {
    const row = document.createElement("div");
    row.className = `option-row ${currentSelection === optIdx ? "selected" : ""}`;
    row.onclick = () => selectOption(optIdx);

    row.innerHTML = `
      <input type="radio" name="cbt_option" class="option-radio" id="opt_${optIdx}" ${currentSelection === optIdx ? "checked" : ""}>
      <label class="option-label" for="opt_${optIdx}">
        <span class="option-index-badge">(${optionLetters[optIdx]})</span>
        <span>${optText}</span>
      </label>
    `;
    optionsContainer.appendChild(row);
  });

  // Highlight active button in palette
  document.querySelectorAll(".q-btn").forEach((btn, idx) => {
    if (idx === state.currentQuestionIndex) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function selectOption(optIdx) {
  state.userResponses[state.currentQuestionIndex] = optIdx;
  renderQuestion();
}

function handleSaveAndNext() {
  const curr = state.currentQuestionIndex;
  const hasAnswer = state.userResponses[curr] !== undefined && state.userResponses[curr] !== null;

  if (hasAnswer) {
    state.questionStatuses[curr] = 2; // Answered (Green)
  } else {
    state.questionStatuses[curr] = 1; // Not Answered (Red)
  }

  advanceToNextQuestion();
}

function handleMarkForReviewAndNext() {
  const curr = state.currentQuestionIndex;
  const hasAnswer = state.userResponses[curr] !== undefined && state.userResponses[curr] !== null;

  if (hasAnswer) {
    state.questionStatuses[curr] = 4; // Answered & Marked for Review (Violet with tick)
  } else {
    state.questionStatuses[curr] = 3; // Marked for Review without answer (Violet)
  }

  advanceToNextQuestion();
}

function handleClearResponse() {
  const curr = state.currentQuestionIndex;
  delete state.userResponses[curr];
  state.questionStatuses[curr] = 1; // Visited but unselected
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
  } else {
    renderPalette();
    openSubmitModal();
  }
}

function navigateToQuestion(newIndex) {
  const curr = state.currentQuestionIndex;
  // If moving away from current question and it was visited but untouched, ensure it's marked Not Answered if no answer
  if (state.questionStatuses[curr] === 0 || state.questionStatuses[curr] === 1) {
    if (state.userResponses[curr] === undefined || state.userResponses[curr] === null) {
      state.questionStatuses[curr] = 1;
    }
  }

  state.currentQuestionIndex = newIndex;

  // If the target question was Not Visited, set to Not Answered
  if (state.questionStatuses[newIndex] === 0) {
    state.questionStatuses[newIndex] = 1;
  }

  renderQuestion();
  renderPalette();
}

// --------------------------------------------------------------------------
// Question Palette Rendering (TCS iON 5-State System)
// --------------------------------------------------------------------------
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

  for (let i = 0; i < total; i++) {
    const status = state.questionStatuses[i] || 0;
    const btn = document.createElement("button");
    btn.textContent = i + 1;
    btn.onclick = () => navigateToQuestion(i);

    let cls = "q-btn ";
    if (i === state.currentQuestionIndex) cls += "active ";

    switch (status) {
      case 0:
        cls += "not-visited";
        counts.notVisited++;
        break;
      case 1:
        cls += "not-answered";
        counts.notAnswered++;
        break;
      case 2:
        cls += "answered";
        counts.answered++;
        break;
      case 3:
        cls += "marked-review";
        counts.markedReview++;
        break;
      case 4:
        cls += "ans-marked-review";
        counts.ansMarkedReview++;
        break;
    }
    btn.className = cls;
    container.appendChild(btn);
  }

  // Update Legend Counter Numbers
  document.getElementById("cnt-not-visited").textContent = counts.notVisited;
  document.getElementById("cnt-not-answered").textContent = counts.notAnswered;
  document.getElementById("cnt-answered").textContent = counts.answered;
  document.getElementById("cnt-marked-review").textContent = counts.markedReview;
  document.getElementById("cnt-ans-marked-review").textContent = counts.ansMarkedReview;
}

// --------------------------------------------------------------------------
// Submission & Results
// --------------------------------------------------------------------------
function openSubmitModal() {
  const total = state.activeQuiz.questions.length;
  let ans = 0, notAns = 0, rev = 0, ansRev = 0, notVis = 0;

  for (let i = 0; i < total; i++) {
    const s = state.questionStatuses[i] || 0;
    if (s === 2) ans++;
    else if (s === 1) notAns++;
    else if (s === 3) rev++;
    else if (s === 4) ansRev++;
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

function submitTest() {
  closeSubmitModal();
  clearInterval(state.timerInterval);

  const quiz = state.activeQuiz;
  const questions = quiz.questions;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  questions.forEach((q, idx) => {
    const userAns = state.userResponses[idx];
    const status = state.questionStatuses[idx];

    // SSC CGL rule: Questions Answered (2) OR Answered & Marked for Review (4) are evaluated!
    const isEvaluated = (status === 2 || status === 4) && userAns !== undefined && userAns !== null;

    if (isEvaluated) {
      if (userAns === q.correct) {
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

  // Render Result View
  const examView = document.getElementById("exam-active-view");
  examView.classList.remove("active");
  examView.style.display = "none";
  document.getElementById("exam-header-timer").style.display = "none";

  const resultView = document.getElementById("result-view");
  resultView.classList.add("active");
  resultView.style.display = "block";
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.getElementById("res-quiz-title").textContent = quiz.title;
  document.getElementById("res-total-score").textContent = `${totalScore.toFixed(2)} / 50.0`;
  document.getElementById("res-accuracy").textContent = `${accuracy}%`;
  document.getElementById("res-attempted").textContent = `${attemptedCount} / 25`;
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

  // Update filter tab counts dynamically
  let corr = 0, incorr = 0, unatt = 0;
  quiz.questions.forEach((q, idx) => {
    const userAns = state.userResponses[idx];
    const status = state.questionStatuses[idx];
    const isEvaluated = (status === 2 || status === 4) && userAns !== undefined && userAns !== null;
    if (isEvaluated) {
      if (userAns === q.correct) corr++;
      else incorr++;
    } else {
      unatt++;
    }
  });

  const tabAll = document.querySelector('.filter-tab[data-filter="all"]');
  const tabInc = document.querySelector('.filter-tab[data-filter="incorrect"]');
  const tabUnatt = document.querySelector('.filter-tab[data-filter="unattempted"]');
  const tabCorr = document.querySelector('.filter-tab[data-filter="correct"]');
  if (tabAll) tabAll.textContent = `All Questions (${quiz.questions.length})`;
  if (tabInc) tabInc.textContent = `❌ Incorrect (${incorr})`;
  if (tabUnatt) tabUnatt.textContent = `⚪ Unattempted (${unatt})`;
  if (tabCorr) tabCorr.textContent = `✔ Correct (${corr})`;

  quiz.questions.forEach((q, idx) => {
    const userAns = state.userResponses[idx];
    const status = state.questionStatuses[idx];
    const isEvaluated = (status === 2 || status === 4) && userAns !== undefined && userAns !== null;

    let evalStatus = "unattempted";
    if (isEvaluated) {
      evalStatus = userAns === q.correct ? "correct" : "incorrect";
    }

    // Filter check
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
        <span>Question ${idx + 1}</span>
        <span>${statusBadgeText}</span>
      </div>
      <div class="solution-question-text">${q.question}</div>
      <div class="solution-options-list">
        ${q.options.map((opt, oIdx) => {
          let optCls = "sol-opt";
          let icon = "";
          if (oIdx === q.correct) {
            optCls += " correct-answer";
            icon = " ✔ [Correct Answer]";
          }
          if (isEvaluated && userAns === oIdx && userAns !== q.correct) {
            optCls += " user-wrong";
            icon = " ✖ [Your Selection]";
          } else if (isEvaluated && userAns === oIdx && userAns === q.correct) {
            icon += " (Your Selection)";
          }
          return `<div class="${optCls}"><strong>(${optionLetters[oIdx]})</strong> ${opt}${icon}</div>`;
        }).join("")}
      </div>
      <div class="explanation-box">
        <strong>💡 Rationale & Key SSC Facts:</strong><br>
        ${q.explanation}
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

  const dashView = document.getElementById("dashboard-view");
  dashView.style.display = "block";
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById("exam-header-title").textContent = "SSC CGL CBT Examination Simulator";
  document.getElementById("exam-header-subtitle").textContent = "General Awareness - Current Affairs Monthly Modules";

  renderDashboard();
}


// Ensure global accessibility across all mobile/tablet browsers
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
