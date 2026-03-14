// ============================================================
//  app.js  —  Frontend Controller
//  YOUR FILE. Handles all screen logic, rendering, animations.
// ============================================================

// ── Screen Navigation ────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const target = document.getElementById('screen-' + id);
  if (target) {
    target.classList.add('active');
    target.style.animation = 'none';
    target.offsetHeight; // reflow
    target.style.animation = 'fadeSlideIn 0.4s ease forwards';
  }
}

// ── Format Helpers ───────────────────────────────────────────
function formatMoney(n) {
  if (n === 0) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(1) + 'Cr';
  if (abs >= 100000)   return sign + '₹' + (abs / 100000).toFixed(1) + 'L';
  if (abs >= 1000)     return sign + '₹' + (abs / 1000).toFixed(0) + 'K';
  return sign + '₹' + abs;
}

function stageLabel(stage) {
  return { student: 'Stage 1 · Student', job: 'Stage 2 · First Job', family: 'Stage 3 · Family', retirement: 'Stage 4 · Retirement' }[stage] || 'Complete';
}

function stageEmoji(stage) {
  return { student: '🎓', job: '💼', family: '🏠', retirement: '🌅' }[stage] || '🏆';
}

function stageProgress(stage, decisionIndex) {
  const totals = { student: 2, job: 2, family: 1, retirement: 1 };
  const total = totals[stage] || 1;
  return Math.round((decisionIndex / total) * 100);
}

// ── Stat Flash Animation ─────────────────────────────────────
let prevState = {};

function flashStat(elId, newVal, oldVal, higherIsBetter = true) {
  const el = document.getElementById(elId);
  if (!el || oldVal === undefined) return;
  const improved = newVal > oldVal;
  const color = (improved === higherIsBetter) ? '#5DCAA5' : '#f09595';
  el.style.transition = 'color 0.2s';
  el.style.color = color;
  setTimeout(() => { el.style.color = ''; }, 1200);
}

// ── Render Game Screen ───────────────────────────────────────
function renderGameScreen() {
  const s = getState();

  flashStat('stat-networth', s.netWorth,    prevState.netWorth,    true);
  flashStat('stat-debt',     s.debt,        prevState.debt,        false);
  flashStat('stat-credit',   s.creditScore, prevState.creditScore, true);
  flashStat('stat-happy',    s.happiness,   prevState.happiness,   true);

  document.getElementById('stat-networth').textContent = formatMoney(s.netWorth);
  document.getElementById('stat-debt').textContent     = formatMoney(s.debt);
  document.getElementById('stat-credit').textContent   = s.creditScore;
  document.getElementById('stat-happy').textContent    = s.happiness + '%';
  document.getElementById('player-age').textContent    = 'Age ' + s.age;
  document.getElementById('stage-tag').textContent     = stageLabel(s.stage);
  document.getElementById('stage-emoji').textContent   = stageEmoji(s.stage);

  const pct = stageProgress(s.stage, s.decisionIndex);
  document.getElementById('stage-bar-fill').style.width = pct + '%';

  const decision = getCurrentDecision();
  if (!decision) return;

  document.getElementById('decision-title').textContent = decision.title;
  document.getElementById('decision-desc').textContent  = decision.description;

  const choicesDiv = document.getElementById('choices');
  choicesDiv.innerHTML = '';
  decision.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn ' + (choice.type || 'neutral');
    btn.innerHTML = `<span class="choice-label">${choice.label}</span>`;
    btn.style.animationDelay = (i * 0.08) + 's';
    btn.classList.add('choice-appear');
    btn.onclick = () => handleChoice(choice.id);
    choicesDiv.appendChild(btn);
  });

  const badgeRow = document.getElementById('badge-row');
  badgeRow.innerHTML = s.badges.map(b =>
    `<span class="badge">${b}</span>`
  ).join('');

  prevState = { ...s };

  fetchAdvisorTip(s);
}

// ── Handle a Player Choice (UPDATED) ─────────────────────────
async function handleChoice(choiceId) {
  applyChoice(choiceId);

  try {
    const s = getState();
    const res = await fetch('http://127.0.0.1:8000/make-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision_id: choiceId,
        stage: s.stage,
        net_worth: s.netWorth,
        debt: s.debt,
        credit_score: s.creditScore,
        happiness: s.happiness
      })
    });

    const data = await res.json();
    console.log('Decision response:', data);

  } catch (err) {
    console.log('Backend offline, using local engine');
  }

  if (isGameOver()) {
    renderEndScreen();
    showScreen('end');
    return;
  }

  const event = checkForEvent();
  if (event) {
    renderEventScreen(event);
    showScreen('event');
  } else {
    renderGameScreen();
    showScreen('game');
  }
}

// ── Event Screen ─────────────────────────────────────────────
function renderEventScreen(event) {
  document.getElementById('event-icon').textContent  = event.icon;
  document.getElementById('event-title').textContent = event.title;
  document.getElementById('event-desc').textContent  = event.description;
  document.getElementById('event-impact').textContent = event.impactText;
  document.getElementById('event-impact').className =
    'event-impact ' + (event.type === 'good' ? 'good' : 'bad');
}

function dismissEvent() {
  renderGameScreen();
  showScreen('game');
}

// ── End / Results Screen ─────────────────────────────────────
function renderEndScreen() {
  const s   = getState();
  const score = getScore();
  const grade = score > 20000 ? 'S' : score > 10000 ? 'A' : score > 5000 ? 'B' : 'C';
  const gradeMsg = { S: 'Financial Legend', A: 'Smart Investor', B: 'Solid Foundation', C: 'Room to Grow' };

  document.getElementById('end-name').textContent       = s.name + "'s Result";
  document.getElementById('end-grade').textContent      = grade;
  document.getElementById('end-grade-msg').textContent  = gradeMsg[grade];
  document.getElementById('end-score').textContent      = score.toLocaleString('en-IN');
  document.getElementById('end-networth').textContent   = formatMoney(s.netWorth);
  document.getElementById('end-credit').textContent     = s.creditScore;
  document.getElementById('end-happiness').textContent  = s.happiness + '%';
  document.getElementById('end-badges').innerHTML       = s.badges.length
    ? s.badges.map(b => `<span class="badge">${b}</span>`).join('')
    : '<span style="color:#666">No badges earned</span>';

  saveScore(s.name, score, s.stage);
}

// ── Leaderboard ──────────────────────────────────────────────
function saveScore(name, score, stage) {
  const board = JSON.parse(localStorage.getItem('ws_scores') || '[]');
  board.push({ name, score, stage, date: new Date().toLocaleDateString('en-IN') });
  board.sort((a, b) => b.score - a.score);
  localStorage.setItem('ws_scores', JSON.stringify(board.slice(0, 10)));
}

function renderLeaderboard() {
  const board = JSON.parse(localStorage.getItem('ws_scores') || '[]');
  const el    = document.getElementById('lb-list');

  if (!board.length) {
    el.innerHTML = '<p style="text-align:center;color:#666;padding:32px">No scores yet. Be the first!</p>';
    return;
  }

  el.innerHTML = board.map((e, i) => `
    <div class="lb-row">
      <span class="lb-rank">${['🥇','🥈','🥉'][i] || (i+1)}</span>
      <div class="lb-info">
        <span class="lb-name">${e.name}</span>
        <span class="lb-meta">${e.stage} · ${e.date}</span>
      </div>
      <span class="lb-score">${Number(e.score).toLocaleString('en-IN')}</span>
    </div>
  `).join('');
}

// ── AI Advisor Tip ───────────────────────────────────────────
const TIPS = {
  high_debt:    "Your debt ratio is alarming. Before anything else — stop accumulating, start paying down.",
  low_credit:   "A credit score below 650 will cost you more on every loan. Pay bills on time, every time.",
  no_invest:    "Money sitting idle loses to inflation. Even ₹1000/month in a SIP beats doing nothing.",
  high_happy:   "Great morale! Happy people make clearer financial decisions. Keep the balance.",
  good_networth:"You're building real wealth. Stay disciplined — compounding rewards patience.",
  default:      "Every rupee saved today is 10 rupees in retirement. The earlier, the better."
};

function fetchAdvisorTip(s) {
  const el = document.getElementById('advisor-tip');
  el.style.opacity = '0.4';
  setTimeout(() => {
    let tip = TIPS.default;
    if (s.debt > 300000 && s.netWorth < s.debt) tip = TIPS.high_debt;
    else if (s.creditScore < 650)               tip = TIPS.low_credit;
    else if (s.netWorth < 10000 && s.turn > 2)  tip = TIPS.no_invest;
    else if (s.happiness >= 85)                 tip = TIPS.high_happy;
    else if (s.netWorth > 500000)               tip = TIPS.good_networth;
    el.textContent = tip;
    el.style.opacity = '1';
  }, 600);
}

// ── Start Game (UPDATED) ─────────────────────────────────────
async function startGame() {
  const name = document.getElementById('player-name').value.trim() || 'Player';
  const goal = document.getElementById('player-goal').value;

  try {
    const res = await fetch('http://127.0.0.1:8000/start-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: name, goal: goal })
    });

    const data = await res.json();
    console.log('Game started:', data);

  } catch (err) {
    console.log('Backend offline, using local game');
  }

  initGame(name, goal);
  prevState = {};
  renderGameScreen();
  showScreen('game');
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showScreen('home');
});
