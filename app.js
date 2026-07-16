(function () {
  'use strict';

  var STORAGE_KEY = 'dailyChampsState_v1';

  var AVATARS = ['🦁', '🐶', '🐱', '🐼', '🦊', '🐸', '🦄', '🐵', '🐧', '🦋', '🐢', '🦖'];

  var CATEGORY_ICONS = {
    reading: '📖', swimming: '🏊', writing: '✍️', chores: '🧹',
    exercise: '🏃', music: '🎵', kindness: '💛', custom: '⭐'
  };

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var PRIZE_EMOJIS = ['🎁', '🍦', '🍕', '🎬', '🎮', '🧸', '📚', '🚴', '🖍️', '🎨', '🏖️', '🕹️', '🍿', '🎡'];

  var BADGES = [
    { id: 'streak7', emoji: '🔥', name: 'Week Warrior', desc: 'Get a 7-day streak', check: function (s) { return s.bestStreak >= 7; } },
    { id: 'points50', emoji: '⭐', name: '50 Club', desc: 'Earn 50 points total', check: function (s) { return s.totalEarned >= 50; } },
    { id: 'firstswim', emoji: '🏊', name: 'First Splash', desc: 'Complete a swimming challenge', check: function (s) { return s.hasSwim; } },
    { id: 'firstread', emoji: '📖', name: 'Bookworm Beginnings', desc: 'Complete a reading challenge', check: function (s) { return s.hasRead; } },
    { id: 'firstwrite', emoji: '✍️', name: 'Wordsmith', desc: 'Complete a writing challenge', check: function (s) { return s.hasWrite; } },
    { id: 'tendown', emoji: '🏆', name: '10 Down', desc: 'Complete 10 challenges', check: function (s) { return s.completedCount >= 10; } },
    { id: 'century', emoji: '💯', name: 'Century', desc: 'Earn 100 points total', check: function (s) { return s.totalEarned >= 100; } },
    { id: 'streak30', emoji: '🌟', name: 'Month Master', desc: 'Get a 30-day streak', check: function (s) { return s.bestStreak >= 30; } },
    { id: 'journey', emoji: '🗓️', name: 'Journey Complete', desc: 'Finish a multi-day challenge', check: function (s) { return s.hasCampaignComplete; } }
  ];

  // ---------------- State ----------------

  function defaultData() {
    return {
      parentPin: null,
      kids: [],
      challenges: [],
      completions: [],
      prizes: [],
      redemptions: [],
      badgesEarned: [],
      activeKidId: null
    };
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign(defaultData(), JSON.parse(raw));
    } catch (e) { /* ignore corrupt storage */ }
    return defaultData();
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  var data = loadData();
  if (!data.activeKidId && data.kids.length) data.activeKidId = data.kids[0].id;

  var ui = {
    mode: 'kid',
    kidScreen: 'today',
    parentScreen: 'queue',
    pinMode: null,
    pinStage: null,
    pinBuffer: '',
    pinFirstEntry: null,
    pinShake: false,
    pinReturnTo: 'parent',
    sheet: null,
    historyKidId: null
  };

  var kidDraft = null, challengeDraft = null, prizeDraft = null, pendingPhoto = null;

  // ---------------- Helpers ----------------

  function uid() { return Math.random().toString(36).slice(2, 10); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateStrOffset(deltaDays) { var d = new Date(); d.setDate(d.getDate() + deltaDays); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function weekdayOf(dateStr) { return new Date(dateStr + 'T00:00:00').getDay(); }
  function addDaysStr(dateStr, n) { var d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function formatDateShort(dateStr) { return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function getActiveKid() { return data.kids.find(function (k) { return k.id === data.activeKidId; }) || null; }
  function getCompletion(challengeId, kidId, date) {
    return data.completions.find(function (c) { return c.challengeId === challengeId && c.kidId === kidId && c.date === date; });
  }
  function getTodaysChallengesForKid(kidId) {
    var wd = weekdayOf(todayStr());
    var today = todayStr();
    return data.challenges.filter(function (c) {
      if (!c.active || c.assignedKidIds.indexOf(kidId) === -1) return false;
      if (c.durationDays) {
        if (c.startDate && today < c.startDate) return false;
        return !getCampaignProgress(c, kidId).isComplete;
      }
      return c.frequency === 'daily' || (Array.isArray(c.frequency) && c.frequency.indexOf(wd) !== -1);
    });
  }
  function getCampaignProgress(challenge, kidId) {
    var start = challenge.startDate || todayStr();
    var relevant = data.completions.filter(function (c) { return c.challengeId === challenge.id && c.kidId === kidId && c.date >= start; });
    var approvedCount = relevant.filter(function (c) { return c.status === 'approved'; }).length;
    var pendingDays = relevant.filter(function (c) { return c.status === 'pending'; }).length;
    var total = challenge.durationDays || 0;
    var remaining = Math.max(0, total - approvedCount);
    return { approvedCount: approvedCount, pendingCount: pendingDays, total: total, remaining: remaining, isComplete: total > 0 && approvedCount >= total, startDate: start };
  }
  function pendingCount() { return data.completions.filter(function (c) { return c.status === 'pending'; }).length; }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function celebrate(msg) {
    toast(msg);
    var layer = document.getElementById('celebrate');
    var colors = ['#FFC93C', '#2EC4B6', '#2ECC71', '#FF7A59'];
    for (var i = 0; i < 24; i++) {
      (function (i) {
        var el = document.createElement('div');
        el.className = 'confetti';
        el.style.left = (Math.random() * 100) + '%';
        el.style.background = colors[i % colors.length];
        el.style.animationDelay = (Math.random() * 0.2) + 's';
        layer.appendChild(el);
        setTimeout(function () { el.remove(); }, 1400);
      })(i);
    }
  }

  // ---------------- Domain logic ----------------

  function updateStreak(kid) {
    var today = todayStr();
    if (kid.lastApprovedDate === today) return;
    var yesterday = dateStrOffset(-1);
    kid.streak = (kid.lastApprovedDate === yesterday) ? (kid.streak + 1) : 1;
    kid.lastApprovedDate = today;
    if (kid.streak > (kid.bestStreak || 0)) kid.bestStreak = kid.streak;
  }

  function checkBadges(kid) {
    var approved = data.completions.filter(function (c) { return c.kidId === kid.id && c.status === 'approved'; });
    function categoryHas(cat) {
      return approved.some(function (c) {
        var ch = data.challenges.find(function (x) { return x.id === c.challengeId; });
        return ch && ch.category === cat;
      });
    }
    var stats = {
      bestStreak: kid.bestStreak || 0,
      totalEarned: kid.totalEarned || 0,
      completedCount: approved.length,
      hasSwim: categoryHas('swimming'),
      hasRead: categoryHas('reading'),
      hasWrite: categoryHas('writing'),
      hasCampaignComplete: data.challenges.some(function (ch) { return ch.durationDays && ch.campaignAwardedKidIds && ch.campaignAwardedKidIds.indexOf(kid.id) !== -1; })
    };
    BADGES.forEach(function (b) {
      var already = data.badgesEarned.some(function (x) { return x.kidId === kid.id && x.badgeId === b.id; });
      if (!already && b.check(stats)) {
        data.badgesEarned.push({ kidId: kid.id, badgeId: b.id, dateEarned: todayStr() });
        celebrate('🏅 New badge: ' + b.name + '!');
      }
    });
  }

  function doApprove(id) {
    var comp = data.completions.find(function (c) { return c.id === id; });
    if (!comp || comp.status !== 'pending') return;
    var c = data.challenges.find(function (x) { return x.id === comp.challengeId; });
    var kid = data.kids.find(function (k) { return k.id === comp.kidId; });
    comp.status = 'approved';
    comp.decidedAt = Date.now();
    if (kid && c) {
      if (c.durationDays) {
        if (!c.campaignAwardedKidIds) c.campaignAwardedKidIds = [];
        var progress = getCampaignProgress(c, kid.id);
        if (progress.isComplete && c.campaignAwardedKidIds.indexOf(kid.id) === -1) {
          kid.points += c.points;
          kid.totalEarned = (kid.totalEarned || 0) + c.points;
          c.campaignAwardedKidIds.push(kid.id);
          celebrate('🏆 ' + c.title + ' complete! +' + c.points + ' points!');
        }
      } else {
        kid.points += c.points;
        kid.totalEarned = (kid.totalEarned || 0) + c.points;
      }
      updateStreak(kid);
      checkBadges(kid);
    }
  }
  function approveCompletion(id) { doApprove(id); saveData(); renderApp(); }
  function approveAll() {
    data.completions.filter(function (c) { return c.status === 'pending'; }).forEach(function (c) { doApprove(c.id); });
    saveData(); renderApp();
  }
  function confirmReject(id) {
    var comp = data.completions.find(function (c) { return c.id === id; });
    var reasonEl = document.getElementById('reject-reason');
    comp.status = 'rejected';
    comp.decidedAt = Date.now();
    comp.rejectReason = reasonEl ? reasonEl.value.trim() : '';
    ui.sheet = null;
    saveData(); renderApp();
  }

  function submitComplete(challengeId) {
    var kid = getActiveKid();
    var c = data.challenges.find(function (x) { return x.id === challengeId; });
    if (!kid || !c) return;
    if (c.requiresPhoto && !pendingPhoto) return;
    var existing = getCompletion(challengeId, kid.id, todayStr());
    if (existing) {
      existing.status = 'pending';
      existing.photo = pendingPhoto;
      existing.submittedAt = Date.now();
      existing.rejectReason = null;
    } else {
      data.completions.push({
        id: uid(), challengeId: challengeId, kidId: kid.id, date: todayStr(),
        status: 'pending', photo: pendingPhoto, submittedAt: Date.now(), decidedAt: null, rejectReason: null
      });
    }
    pendingPhoto = null;
    ui.sheet = null;
    saveData();
    celebrate('🎉 Sent for approval!');
    renderApp();
  }

  function confirmRedeem(prizeId) {
    var p = data.prizes.find(function (x) { return x.id === prizeId; });
    var kid = getActiveKid();
    if (!p || !kid || kid.points < p.cost) return;
    kid.points -= p.cost;
    data.redemptions.push({ id: uid(), prizeId: p.id, kidId: kid.id, pointsSpent: p.cost, status: 'pending', redeemedAt: Date.now(), fulfilledAt: null });
    ui.sheet = null;
    saveData();
    celebrate('🎁 Redeemed! Waiting for a grown-up.');
    renderApp();
  }

  function fulfillRedemption(id) {
    var r = data.redemptions.find(function (x) { return x.id === id; });
    if (r) { r.status = 'fulfilled'; r.fulfilledAt = Date.now(); }
    saveData(); renderApp();
  }

  function handlePhotoFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var maxDim = 800, w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = h * (maxDim / w); w = maxDim; }
        else if (h > maxDim) { w = w * (maxDim / h); h = maxDim; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        pendingPhoto = canvas.toDataURL('image/jpeg', 0.7);
        renderApp();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ---------------- Kid CRUD ----------------

  function openEditKid(id) {
    var k = id ? data.kids.find(function (x) { return x.id === id; }) : null;
    kidDraft = k ? { id: k.id, name: k.name, avatar: k.avatar } : { id: null, name: '', avatar: AVATARS[0] };
    ui.sheet = { type: 'editKid' };
    renderApp();
  }
  function pickAvatar(a) { kidDraft.avatar = a; renderApp(); }
  function saveKid() {
    var nameEl = document.getElementById('kid-name-input');
    var name = (nameEl ? nameEl.value : kidDraft.name).trim();
    if (!name) { toast('Please enter a name'); return; }
    if (kidDraft.id) {
      var k = data.kids.find(function (x) { return x.id === kidDraft.id; });
      k.name = name; k.avatar = kidDraft.avatar;
    } else {
      var newKid = { id: uid(), name: name, avatar: kidDraft.avatar, points: 0, totalEarned: 0, streak: 0, bestStreak: 0, lastApprovedDate: null, createdAt: Date.now() };
      data.kids.push(newKid);
      if (!data.activeKidId) data.activeKidId = newKid.id;
    }
    kidDraft = null; ui.sheet = null;
    saveData(); renderApp();
  }
  function deleteKid(id) {
    if (!confirm('Remove this kid and their history? This cannot be undone.')) return;
    data.kids = data.kids.filter(function (k) { return k.id !== id; });
    data.completions = data.completions.filter(function (c) { return c.kidId !== id; });
    data.redemptions = data.redemptions.filter(function (r) { return r.kidId !== id; });
    data.challenges.forEach(function (c) { c.assignedKidIds = c.assignedKidIds.filter(function (x) { return x !== id; }); });
    if (data.activeKidId === id) data.activeKidId = data.kids.length ? data.kids[0].id : null;
    ui.sheet = null; kidDraft = null;
    saveData(); renderApp();
  }

  // ---------------- Challenge CRUD ----------------

  function openEditChallenge(id) {
    var c = id ? data.challenges.find(function (x) { return x.id === id; }) : null;
    challengeDraft = c
      ? { id: c.id, title: c.title, category: c.category, points: c.points, requiresPhoto: c.requiresPhoto, frequency: c.frequency, assignedKidIds: c.assignedKidIds.slice(), active: c.active, durationDays: c.durationDays || null, startDate: c.startDate || null }
      : { id: null, title: '', category: 'reading', points: 10, requiresPhoto: false, frequency: 'daily', assignedKidIds: data.kids.map(function (k) { return k.id; }), active: true, durationDays: null, startDate: null };
    ui.sheet = { type: 'editChallenge' };
    renderApp();
  }
  function toggleFrequencyDay(i) {
    i = parseInt(i, 10);
    if (challengeDraft.frequency === 'daily') challengeDraft.frequency = [];
    var idx = challengeDraft.frequency.indexOf(i);
    if (idx >= 0) challengeDraft.frequency.splice(idx, 1); else challengeDraft.frequency.push(i);
    renderApp();
  }
  function saveChallenge() {
    var titleEl = document.getElementById('challenge-title-input');
    var pointsEl = document.getElementById('challenge-points-input');
    var title = (titleEl ? titleEl.value : challengeDraft.title).trim();
    var points = pointsEl ? Math.max(1, parseInt(pointsEl.value, 10) || 10) : challengeDraft.points;
    if (!title) { toast('Please enter a title'); return; }
    if (!challengeDraft.assignedKidIds.length) { toast('Pick at least one kid'); return; }

    var isCampaign = !!challengeDraft.durationDays;
    var durationDays = null, startDate = null, frequency = challengeDraft.frequency;
    if (isCampaign) {
      var durationEl = document.getElementById('challenge-duration-input');
      durationDays = Math.max(2, parseInt(durationEl ? durationEl.value : challengeDraft.durationDays, 10) || challengeDraft.durationDays);
      var startEl = document.getElementById('challenge-startdate-input');
      startDate = (startEl && startEl.value) ? startEl.value : (challengeDraft.startDate || todayStr());
      frequency = 'daily';
    }

    if (challengeDraft.id) {
      var c = data.challenges.find(function (x) { return x.id === challengeDraft.id; });
      Object.assign(c, { title: title, category: challengeDraft.category, points: points, requiresPhoto: challengeDraft.requiresPhoto, frequency: frequency, assignedKidIds: challengeDraft.assignedKidIds, active: challengeDraft.active, durationDays: durationDays, startDate: startDate });
      if (!c.campaignAwardedKidIds) c.campaignAwardedKidIds = [];
    } else {
      data.challenges.push({ id: uid(), title: title, category: challengeDraft.category, points: points, requiresPhoto: challengeDraft.requiresPhoto, frequency: frequency, assignedKidIds: challengeDraft.assignedKidIds, active: true, durationDays: durationDays, startDate: startDate, campaignAwardedKidIds: [] });
    }
    challengeDraft = null; ui.sheet = null;
    saveData(); renderApp();
  }
  function deleteChallenge(id) {
    if (!confirm('Delete this challenge permanently? Past history will keep the record but it will show as removed.')) return;
    data.challenges = data.challenges.filter(function (c) { return c.id !== id; });
    challengeDraft = null; ui.sheet = null;
    saveData(); renderApp();
  }

  // ---------------- Prize CRUD ----------------

  function openEditPrize(id) {
    var p = id ? data.prizes.find(function (x) { return x.id === id; }) : null;
    prizeDraft = p
      ? { id: p.id, name: p.name, emoji: p.emoji, cost: p.cost, isRealWorld: p.isRealWorld, active: p.active }
      : { id: null, name: '', emoji: PRIZE_EMOJIS[0], cost: 20, isRealWorld: true, active: true };
    ui.sheet = { type: 'editPrize' };
    renderApp();
  }
  function savePrize() {
    var nameEl = document.getElementById('prize-name-input');
    var costEl = document.getElementById('prize-cost-input');
    var name = (nameEl ? nameEl.value : prizeDraft.name).trim();
    var cost = costEl ? Math.max(1, parseInt(costEl.value, 10) || 10) : prizeDraft.cost;
    if (!name) { toast('Please enter a prize name'); return; }
    if (prizeDraft.id) {
      var p = data.prizes.find(function (x) { return x.id === prizeDraft.id; });
      Object.assign(p, { name: name, cost: cost, emoji: prizeDraft.emoji, isRealWorld: prizeDraft.isRealWorld, active: prizeDraft.active });
    } else {
      data.prizes.push({ id: uid(), name: name, cost: cost, emoji: prizeDraft.emoji, isRealWorld: prizeDraft.isRealWorld, active: true });
    }
    prizeDraft = null; ui.sheet = null;
    saveData(); renderApp();
  }
  function deletePrize(id) {
    if (!confirm('Delete this prize permanently?')) return;
    data.prizes = data.prizes.filter(function (p) { return p.id !== id; });
    prizeDraft = null; ui.sheet = null;
    saveData(); renderApp();
  }

  // ---------------- PIN flow ----------------

  function handlePinComplete() {
    if (ui.pinMode === 'setup') {
      if (ui.pinStage !== 'confirm') {
        ui.pinFirstEntry = ui.pinBuffer;
        ui.pinBuffer = '';
        ui.pinStage = 'confirm';
        renderApp();
      } else if (ui.pinBuffer === ui.pinFirstEntry) {
        data.parentPin = ui.pinBuffer;
        saveData();
        finishPinSuccess();
      } else {
        ui.pinShake = true; renderApp();
        setTimeout(function () {
          ui.pinShake = false; ui.pinBuffer = ''; ui.pinStage = null; ui.pinFirstEntry = null;
          renderApp();
        }, 400);
      }
    } else {
      if (ui.pinBuffer === data.parentPin) {
        finishPinSuccess();
      } else {
        ui.pinShake = true; renderApp();
        setTimeout(function () { ui.pinShake = false; ui.pinBuffer = ''; renderApp(); }, 400);
      }
    }
  }
  function finishPinSuccess() {
    var returnTo = ui.pinReturnTo;
    ui.pinBuffer = ''; ui.pinStage = null; ui.pinFirstEntry = null; ui.pinMode = null;
    ui.mode = 'parent';
    ui.parentScreen = (returnTo === 'onboarding') ? 'kids' : (ui.parentScreen || 'queue');
    renderApp();
  }

  // ---------------- Click / change delegation ----------------

  function handleClick(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.dataset.action;
    var id = el.dataset.id;

    switch (action) {
      case 'none':
        return;
      case 'start-onboarding':
        ui.mode = 'pin'; ui.pinMode = 'setup'; ui.pinStage = null; ui.pinBuffer = ''; ui.pinReturnTo = 'onboarding';
        break;
      case 'open-parent-gate':
        ui.mode = 'pin'; ui.pinMode = data.parentPin ? 'enter' : 'setup'; ui.pinBuffer = ''; ui.pinStage = null; ui.pinReturnTo = 'parent';
        break;
      case 'pin-key':
        if (ui.pinBuffer.length < 4) ui.pinBuffer += id;
        if (ui.pinBuffer.length === 4) setTimeout(handlePinComplete, 180);
        break;
      case 'pin-back':
        ui.pinBuffer = ui.pinBuffer.slice(0, -1);
        break;
      case 'pin-cancel':
        ui.mode = 'kid'; ui.pinBuffer = ''; ui.pinStage = null;
        break;
      case 'forgot-pin':
        if (confirm('This erases all kids, challenges, prizes and history on this device and starts over. Continue?')) {
          localStorage.removeItem(STORAGE_KEY);
          data = defaultData();
          ui.mode = 'kid'; ui.pinBuffer = ''; ui.pinStage = null; ui.pinMode = null;
          saveData();
        }
        break;
      case 'exit-parent':
        ui.mode = 'kid'; ui.kidScreen = 'today';
        break;
      case 'nav-kid':
        ui.kidScreen = id;
        break;
      case 'nav-parent':
        ui.parentScreen = id;
        break;
      case 'open-switch-kid':
        ui.sheet = { type: 'switchKid' };
        break;
      case 'switch-kid':
        data.activeKidId = id; ui.sheet = null; saveData();
        break;
      case 'open-complete':
        pendingPhoto = null; ui.sheet = { type: 'complete', challengeId: id };
        break;
      case 'open-campaign':
        pendingPhoto = null; ui.sheet = { type: 'campaign', challengeId: id };
        break;
      case 'open-pending':
        ui.sheet = { type: 'pending', challengeId: id };
        break;
      case 'undo-complete': {
        var kid = getActiveKid();
        data.completions = data.completions.filter(function (c) { return !(c.challengeId === id && kid && c.kidId === kid.id && c.date === todayStr()); });
        ui.sheet = null; saveData();
        break;
      }
      case 'pick-photo':
        var input = document.getElementById('photo-input');
        if (input) input.click();
        return;
      case 'submit-complete':
        submitComplete(id); return;
      case 'close-sheet':
        ui.sheet = null; pendingPhoto = null;
        break;
      case 'open-redeem':
        ui.sheet = { type: 'redeem', prizeId: id };
        break;
      case 'confirm-redeem':
        confirmRedeem(id); return;
      case 'approve':
        approveCompletion(id); return;
      case 'approve-all':
        approveAll(); return;
      case 'reject':
        ui.sheet = { type: 'reject', completionId: id };
        break;
      case 'confirm-reject':
        confirmReject(id); return;
      case 'edit-kid':
        openEditKid(id || null); return;
      case 'pick-avatar':
        pickAvatar(id); return;
      case 'save-kid':
        saveKid(); return;
      case 'delete-kid':
        deleteKid(id); return;
      case 'edit-challenge':
        openEditChallenge(id || null); return;
      case 'pick-category':
        challengeDraft.category = id; break;
      case 'set-frequency-daily':
        challengeDraft.frequency = 'daily'; break;
      case 'toggle-frequency-day':
        toggleFrequencyDay(id); return;
      case 'toggle-campaign':
        challengeDraft.durationDays = challengeDraft.durationDays ? null : 30;
        if (challengeDraft.durationDays) {
          challengeDraft.startDate = challengeDraft.startDate || todayStr();
          challengeDraft.frequency = 'daily';
        }
        break;
      case 'pick-duration-preset':
        challengeDraft.durationDays = parseInt(id, 10);
        break;
      case 'toggle-photo-required':
        challengeDraft.requiresPhoto = !challengeDraft.requiresPhoto; break;
      case 'toggle-assigned-kid': {
        var idx = challengeDraft.assignedKidIds.indexOf(id);
        if (idx >= 0) challengeDraft.assignedKidIds.splice(idx, 1); else challengeDraft.assignedKidIds.push(id);
        break;
      }
      case 'toggle-challenge-active':
        challengeDraft.active = !challengeDraft.active; break;
      case 'save-challenge':
        saveChallenge(); return;
      case 'delete-challenge':
        deleteChallenge(id); return;
      case 'edit-prize':
        openEditPrize(id || null); return;
      case 'pick-prize-emoji':
        prizeDraft.emoji = id; break;
      case 'toggle-prize-realworld':
        prizeDraft.isRealWorld = !prizeDraft.isRealWorld; break;
      case 'toggle-prize-active':
        prizeDraft.active = !prizeDraft.active; break;
      case 'save-prize':
        savePrize(); return;
      case 'delete-prize':
        deletePrize(id); return;
      case 'fulfill-redemption':
        fulfillRedemption(id); return;
      case 'pick-history-kid':
        ui.historyKidId = id; break;
      default:
        return;
    }
    renderApp();
  }

  function handleChange(e) {
    if (e.target && e.target.id === 'photo-input' && e.target.files && e.target.files[0]) {
      handlePhotoFile(e.target.files[0]);
    }
  }

  window.__dc = {
    updateKidDraft: function (field, value) { if (kidDraft) kidDraft[field] = value; },
    updateChallengeDraft: function (field, value) { if (challengeDraft) challengeDraft[field] = value; },
    updatePrizeDraft: function (field, value) { if (prizeDraft) prizeDraft[field] = value; }
  };

  // ---------------- Rendering ----------------

  function renderApp() {
    var app = document.getElementById('app');
    var html;
    if (!data.parentPin && ui.mode !== 'pin') {
      html = renderWelcome();
    } else if (ui.mode === 'pin') {
      html = renderPinScreen();
    } else if (ui.mode === 'parent') {
      html = renderParentMode();
    } else {
      html = renderKidMode();
    }
    html += renderSheet();
    app.innerHTML = html;
  }

  function renderWelcome() {
    return '<div class="screen" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;min-height:100vh;min-height:100dvh;">' +
      '<div style="font-size:64px;margin-bottom:10px;">🏆</div>' +
      '<h1>Daily Champs</h1>' +
      '<p class="hint">Daily challenges for your kid — reading, swimming, writing and more. Complete a challenge, earn points, unlock prizes!</p>' +
      '<button class="btn btn-brand" data-action="start-onboarding" style="margin-top:20px;">Let\'s get set up</button>' +
      '</div>';
  }

  function renderPinScreen() {
    var isSetup = ui.pinMode === 'setup';
    var isConfirm = isSetup && ui.pinStage === 'confirm';
    var title = isConfirm ? 'Confirm your PIN' : (isSetup ? 'Set a Parent PIN' : 'Enter Parent PIN');
    var sub = isSetup ? "Kids won't see this — it keeps approvals and settings just for grown-ups." : '';
    var dots = [0, 1, 2, 3].map(function (i) {
      return '<div class="pin-dot ' + (i < ui.pinBuffer.length ? 'filled' : '') + '"></div>';
    }).join('');
    var keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
      return '<button class="pin-key" data-action="pin-key" data-id="' + n + '">' + n + '</button>';
    }).join('');
    return '<div class="pin-screen">' +
      '<button class="btn btn-outline btn-sm" data-action="pin-cancel" style="align-self:flex-start;">← Back</button>' +
      '<div style="font-size:44px;">🔒</div>' +
      '<h1 style="margin:0;">' + title + '</h1>' +
      (sub ? '<p class="hint" style="text-align:center;">' + sub + '</p>' : '') +
      '<div class="pin-dots ' + (ui.pinShake ? 'shake' : '') + '">' + dots + '</div>' +
      '<div class="pin-pad">' + keys +
      '<div></div>' +
      '<button class="pin-key" data-action="pin-key" data-id="0">0</button>' +
      '<button class="pin-key" data-action="pin-back" aria-label="Backspace">⌫</button>' +
      '</div>' +
      (!isSetup ? '<button class="btn btn-outline btn-sm" data-action="forgot-pin">Forgot PIN? Reset app</button>' : '') +
      '</div>';
  }

  // ---- Kid mode ----

  function renderKidMode() {
    var kid = getActiveKid();
    var body;
    if (!kid) body = renderNoKidState();
    else if (ui.kidScreen === 'prizes') body = renderPrizes(kid);
    else if (ui.kidScreen === 'badges') body = renderBadgesScreen(kid);
    else body = renderToday(kid);

    var chip = kid
      ? '<button class="kid-chip" data-action="open-switch-kid"><span class="avatar">' + kid.avatar + '</span><span class="name">' + esc(kid.name) + '</span></button>'
      : '<div></div>';
    var stats = kid
      ? '<div class="stats"><div class="stat-pill">⭐ ' + kid.points + '</div><div class="stat-pill">🔥 ' + kid.streak + '</div></div>'
      : '';

    return '<div class="topbar">' + chip +
      '<div style="display:flex;align-items:center;gap:8px;">' + stats +
      '<button class="icon-btn" data-action="open-parent-gate" aria-label="Parent settings">⚙️</button>' +
      '</div></div>' +
      '<div class="screen">' + body + '</div>' +
      renderBottomNav();
  }

  function renderNoKidState() {
    return '<div class="empty-state"><div class="emoji">🧒</div><p>No kid profile yet.<br/>Ask a grown-up to add one in Parent Mode (⚙️).</p></div>';
  }

  function renderBottomNav() {
    var items = [['today', '🏠', 'Today'], ['prizes', '🎁', 'Prizes'], ['badges', '🏅', 'Badges']];
    return '<div class="bottom-nav">' + items.map(function (it) {
      return '<button class="nav-btn ' + (ui.kidScreen === it[0] ? 'active' : '') + '" data-action="nav-kid" data-id="' + it[0] + '"><span class="icon">' + it[1] + '</span>' + it[2] + '</button>';
    }).join('') + '</div>';
  }

  function renderToday(kid) {
    var todays = getTodaysChallengesForKid(kid.id);
    var dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var header = '<h1>Today</h1><p class="hint" style="margin-top:-10px;">' + dateLabel + '</p>';
    if (!todays.length) {
      return header + '<div class="empty-state"><div class="emoji">🌤️</div><p>No challenges today! ' +
        (data.challenges.length ? 'Enjoy your free day.' : 'Ask a grown-up to add some.') + '</p></div>';
    }
    return header + todays.map(function (c) { return challengeCard(c, kid); }).join('');
  }

  function challengeCard(c, kid) {
    if (c.durationDays) return campaignChallengeCard(c, kid);
    var comp = getCompletion(c.id, kid.id, todayStr());
    var pill, action = 'open-complete';
    if (!comp) {
      pill = '<span class="pill todo">⬜ To do</span>';
    } else if (comp.status === 'pending') {
      pill = '<span class="pill pending">⏳ Waiting for approval</span>';
      action = 'open-pending';
    } else if (comp.status === 'approved') {
      pill = '<span class="pill approved">✅ Approved!</span>';
      action = null;
    } else {
      pill = '<span class="pill tryagain">🔁 Try again' + (comp.rejectReason ? ': ' + esc(comp.rejectReason) : '') + '</span>';
    }
    var attrs = action ? ' data-action="' + action + '" data-id="' + c.id + '"' : '';
    return '<div class="card ' + (action ? 'clickable' : '') + '"' + attrs + '>' +
      '<div class="emoji">' + (CATEGORY_ICONS[c.category] || '⭐') + '</div>' +
      '<div class="body"><div class="title">' + esc(c.title) + '</div>' +
      '<div class="sub">⭐ ' + c.points + ' pts' + (c.requiresPhoto ? ' · 📷 photo needed' : '') + '</div>' +
      pill + '</div></div>';
  }

  function campaignChallengeCard(c, kid) {
    var progress = getCampaignProgress(c, kid.id);
    var comp = getCompletion(c.id, kid.id, todayStr());
    var pill;
    if (comp && comp.status === 'pending') pill = '<span class="pill pending">⏳ Waiting for approval</span>';
    else if (comp && comp.status === 'approved') pill = '<span class="pill approved">✅ Checked in today</span>';
    else if (comp && comp.status === 'rejected') pill = '<span class="pill tryagain">🔁 Try again</span>';
    else pill = '<span class="pill todo">⬜ Check in today</span>';
    var pct = progress.total ? Math.min(100, Math.round(progress.approvedCount / progress.total * 100)) : 0;
    return '<div class="card clickable" data-action="open-campaign" data-id="' + c.id + '">' +
      '<div class="emoji">' + (CATEGORY_ICONS[c.category] || '⭐') + '</div>' +
      '<div class="body"><div class="title">' + esc(c.title) + '</div>' +
      '<div class="sub">🗓️ ' + progress.approvedCount + ' of ' + progress.total + ' days · 🏆 ' + c.points + ' pts when done</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      pill + '</div></div>';
  }

  function renderPrizes(kid) {
    var activePrizes = data.prizes.filter(function (p) { return p.active; });
    var cards = activePrizes.map(function (p) {
      var afford = kid.points >= p.cost;
      return '<div class="prize-card"><div class="emoji">' + (p.emoji || '🎁') + '</div>' +
        '<div class="name">' + esc(p.name) + '</div>' +
        '<div class="cost">⭐ ' + p.cost + (p.isRealWorld ? ' · 🎈' : '') + '</div>' +
        '<button class="btn ' + (afford ? 'btn-brand' : 'btn-outline') + ' btn-sm" data-action="open-redeem" data-id="' + p.id + '" ' + (afford ? '' : 'disabled') + '>' +
        (afford ? 'Redeem' : 'Need ' + (p.cost - kid.points) + ' more') + '</button></div>';
    }).join('');

    var myReds = data.redemptions.filter(function (r) { return r.kidId === kid.id; }).sort(function (a, b) { return b.redeemedAt - a.redeemedAt; });
    var redRows = myReds.map(function (r) {
      var p = data.prizes.find(function (x) { return x.id === r.prizeId; });
      return '<div class="list-row"><div class="grow"><div class="title">' + (p ? p.emoji + ' ' + esc(p.name) : '(removed prize)') + '</div>' +
        '<div class="sub">' + new Date(r.redeemedAt).toLocaleDateString() + '</div></div>' +
        '<span class="pill ' + (r.status === 'fulfilled' ? 'approved' : 'pending') + '">' + (r.status === 'fulfilled' ? '✅ Ready!' : '⏳ Pending') + '</span></div>';
    }).join('');

    return '<h1>🎁 Prize Wall</h1>' +
      (activePrizes.length ? '<div class="prize-grid">' + cards + '</div>' : '<div class="empty-state"><div class="emoji">🎁</div><p>No prizes yet. Ask a grown-up to add some!</p></div>') +
      (myReds.length ? '<h2>My Redemptions</h2>' + redRows : '');
  }

  function renderBadgesScreen(kid) {
    var earnedIds = {};
    data.badgesEarned.filter(function (b) { return b.kidId === kid.id; }).forEach(function (b) { earnedIds[b.badgeId] = true; });
    var cards = BADGES.map(function (b) {
      var earned = !!earnedIds[b.id];
      return '<div class="badge-card ' + (earned ? '' : 'locked') + '"><div class="emoji">' + b.emoji + '</div>' +
        '<div class="name">' + b.name + '</div><div class="desc">' + (earned ? 'Earned!' : b.desc) + '</div></div>';
    }).join('');
    return '<h1>🏅 My Badges</h1><div class="badge-grid">' + cards + '</div>';
  }

  // ---- Parent mode ----

  function renderParentMode() {
    var tabs = [['queue', 'Approvals'], ['kids', 'Kids'], ['challenges', 'Challenges'], ['prizes', 'Prizes'], ['history', 'History']];
    var body;
    switch (ui.parentScreen) {
      case 'kids': body = renderManageKids(); break;
      case 'challenges': body = renderManageChallenges(); break;
      case 'prizes': body = renderManagePrizes(); break;
      case 'history': body = renderHistory(); break;
      default: body = renderQueue();
    }
    var pc = pendingCount();
    var tabsHtml = tabs.map(function (t) {
      var label = t[1] + (t[0] === 'queue' && pc ? ' (' + pc + ')' : '');
      return '<button class="parent-tab ' + (ui.parentScreen === t[0] ? 'active' : '') + '" data-action="nav-parent" data-id="' + t[0] + '">' + label + '</button>';
    }).join('');
    return '<div class="topbar"><div style="font-weight:800;font-size:19px;">👪 Parent Mode</div><div></div></div>' +
      '<div class="parent-tabs">' + tabsHtml + '</div>' +
      '<div class="screen">' + body + '</div>' +
      '<div class="exit-parent"><button class="btn btn-outline" data-action="exit-parent">Exit Parent Mode</button></div>';
  }

  function renderQueue() {
    var pending = data.completions.filter(function (c) { return c.status === 'pending'; }).sort(function (a, b) { return a.submittedAt - b.submittedAt; });
    if (!pending.length) return '<div class="empty-state"><div class="emoji">🎉</div><p>All caught up!</p></div>';
    var rows = pending.map(function (comp) {
      var c = data.challenges.find(function (x) { return x.id === comp.challengeId; });
      var kid = data.kids.find(function (k) { return k.id === comp.kidId; });
      return '<div class="card"><div class="emoji">' + (c ? (CATEGORY_ICONS[c.category] || '⭐') : '⭐') + '</div>' +
        '<div class="body"><div class="title">' + (kid ? kid.avatar + ' ' + esc(kid.name) : '?') + ' · ' + esc(c ? c.title : '(deleted)') + '</div>' +
        '<div class="sub">' + new Date(comp.submittedAt).toLocaleString() + '</div>' +
        (comp.photo ? '<img class="photo-preview" style="max-height:140px;" src="' + comp.photo + '" />' : '') +
        '<div class="btn-row" style="margin-top:8px;">' +
        '<button class="btn btn-primary btn-sm" data-action="approve" data-id="' + comp.id + '">✓ Approve</button>' +
        '<button class="btn btn-danger btn-sm" data-action="reject" data-id="' + comp.id + '">✕ Reject</button>' +
        '</div></div></div>';
    }).join('');
    var bulk = pending.length > 1 ? '<button class="btn btn-accent" data-action="approve-all" style="margin-bottom:12px;">✓ Approve all (' + pending.length + ')</button>' : '';
    return bulk + rows;
  }

  function renderManageKids() {
    var rows = data.kids.map(function (k) {
      return '<div class="list-row"><span class="avatar" style="font-size:28px;">' + k.avatar + '</span>' +
        '<div class="grow"><div class="title">' + esc(k.name) + '</div><div class="sub">⭐ ' + k.points + ' pts · 🔥 ' + k.streak + ' day streak</div></div>' +
        '<button class="icon-btn" data-action="edit-kid" data-id="' + k.id + '" aria-label="Edit">✏️</button></div>';
    }).join('');
    return '<h1>👪 Kids</h1>' + rows +
      (!data.kids.length ? '<div class="empty-state"><div class="emoji">🧒</div><p>Add your first kid to get started.</p></div>' : '') +
      '<button class="btn btn-brand" data-action="edit-kid" data-id="">+ Add Kid</button>';
  }

  function renderManageChallenges() {
    var rows = data.challenges.map(function (c) {
      var freq = c.durationDays
        ? ('🗓️ ' + c.durationDays + '-day · starts ' + formatDateShort(c.startDate))
        : (c.frequency === 'daily' ? 'Every day' : c.frequency.map(function (d) { return WEEKDAYS[d]; }).join(', '));
      return '<div class="list-row"><span style="font-size:26px;">' + (CATEGORY_ICONS[c.category] || '⭐') + '</span>' +
        '<div class="grow"><div class="title">' + esc(c.title) + (c.active ? '' : ' (inactive)') + '</div>' +
        '<div class="sub">⭐ ' + c.points + ' · ' + freq + (c.requiresPhoto ? ' · 📷' : '') + '</div></div>' +
        '<button class="icon-btn" data-action="edit-challenge" data-id="' + c.id + '" aria-label="Edit">✏️</button></div>';
    }).join('');
    return '<h1>📋 Challenges</h1>' + rows +
      (!data.challenges.length ? '<div class="empty-state"><div class="emoji">📋</div><p>Add your first challenge.</p></div>' : '') +
      '<button class="btn btn-brand" data-action="edit-challenge" data-id="">+ Add Challenge</button>';
  }

  function renderManagePrizes() {
    var pendingReds = data.redemptions.filter(function (r) { return r.status === 'pending'; }).sort(function (a, b) { return a.redeemedAt - b.redeemedAt; });
    var pendingRows = pendingReds.map(function (r) {
      var p = data.prizes.find(function (x) { return x.id === r.prizeId; });
      var kid = data.kids.find(function (k) { return k.id === r.kidId; });
      return '<div class="list-row"><span style="font-size:26px;">' + (p ? p.emoji : '🎁') + '</span>' +
        '<div class="grow"><div class="title">' + (kid ? kid.avatar + ' ' + esc(kid.name) : '?') + ' · ' + (p ? esc(p.name) : '(removed)') + '</div>' +
        '<div class="sub">' + new Date(r.redeemedAt).toLocaleDateString() + '</div></div>' +
        '<button class="btn btn-primary btn-sm" data-action="fulfill-redemption" data-id="' + r.id + '">✓ Fulfilled</button></div>';
    }).join('');

    var rows = data.prizes.map(function (p) {
      return '<div class="list-row"><span style="font-size:26px;">' + p.emoji + '</span>' +
        '<div class="grow"><div class="title">' + esc(p.name) + (p.active ? '' : ' (inactive)') + '</div>' +
        '<div class="sub">⭐ ' + p.cost + (p.isRealWorld ? ' · real-world prize' : '') + '</div></div>' +
        '<button class="icon-btn" data-action="edit-prize" data-id="' + p.id + '" aria-label="Edit">✏️</button></div>';
    }).join('');

    return (pendingReds.length ? '<h1>📦 Pending Fulfillment</h1>' + pendingRows : '') +
      '<h1>🎁 Prizes</h1>' + rows +
      (!data.prizes.length ? '<div class="empty-state"><div class="emoji">🎁</div><p>Add your first prize.</p></div>' : '') +
      '<button class="btn btn-brand" data-action="edit-prize" data-id="">+ Add Prize</button>';
  }

  function renderHistory() {
    if (!data.kids.length) return '<div class="empty-state"><div class="emoji">📊</div><p>Add a kid to see history.</p></div>';
    if (!ui.historyKidId || !data.kids.find(function (k) { return k.id === ui.historyKidId; })) ui.historyKidId = data.kids[0].id;
    var kid = data.kids.find(function (k) { return k.id === ui.historyKidId; });
    var kidChips = data.kids.map(function (k) {
      return '<button class="chip ' + (k.id === kid.id ? 'selected' : '') + '" data-action="pick-history-kid" data-id="' + k.id + '">' + k.avatar + ' ' + esc(k.name) + '</button>';
    }).join('');

    var days = [];
    for (var i = 6; i >= 0; i--) days.push(dateStrOffset(-i));
    var weekApproved = data.completions.filter(function (c) { return c.kidId === kid.id && c.status === 'approved' && days.indexOf(c.date) !== -1; });
    var weekPoints = weekApproved.reduce(function (sum, c) {
      var ch = data.challenges.find(function (x) { return x.id === c.challengeId; });
      if (!ch) return sum;
      if (ch.durationDays) {
        var chApproved = data.completions.filter(function (x) { return x.challengeId === ch.id && x.kidId === kid.id && x.status === 'approved'; }).sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
        var payoutCompletion = chApproved[ch.durationDays - 1];
        return sum + (payoutCompletion && payoutCompletion.id === c.id ? ch.points : 0);
      }
      return sum + ch.points;
    }, 0);

    var logRows = days.slice().reverse().map(function (date) {
      var dayItems = data.completions.filter(function (c) { return c.kidId === kid.id && c.date === date; });
      if (!dayItems.length) return '';
      var rows = dayItems.map(function (c) {
        var ch = data.challenges.find(function (x) { return x.id === c.challengeId; });
        var icon = c.status === 'approved' ? '✅' : (c.status === 'rejected' ? '🔁' : '⏳');
        return '<div class="sub">' + icon + ' ' + (ch ? esc(ch.title) : '(deleted)') + '</div>';
      }).join('');
      return '<div class="list-row" style="align-items:flex-start;flex-direction:column;"><div class="title">' + date + '</div>' + rows + '</div>';
    }).join('');

    return '<h1>📊 History</h1>' +
      '<div class="chip-select" style="margin-bottom:14px;">' + kidChips + '</div>' +
      '<div class="card"><div class="body"><div class="title">This week</div>' +
      '<div class="sub">' + weekApproved.length + ' challenges done · ⭐ ' + weekPoints + ' earned · 🔥 ' + kid.streak + ' day streak</div></div></div>' +
      '<h2>Day by day</h2>' + (logRows || '<p class="hint">No activity yet.</p>');
  }

  // ---- Sheets ----

  function renderSheet() {
    if (!ui.sheet) return '';
    switch (ui.sheet.type) {
      case 'switchKid': return renderSwitchKidSheet();
      case 'complete': return renderCompleteSheet(ui.sheet.challengeId);
      case 'campaign': return renderCampaignSheet(ui.sheet.challengeId);
      case 'pending': return renderPendingSheet(ui.sheet.challengeId);
      case 'redeem': return renderRedeemSheet(ui.sheet.prizeId);
      case 'reject': return renderRejectSheet(ui.sheet.completionId);
      case 'editKid': return renderEditKidSheet();
      case 'editChallenge': return renderEditChallengeSheet();
      case 'editPrize': return renderEditPrizeSheet();
      default: return '';
    }
  }

  function renderSwitchKidSheet() {
    var rows = data.kids.map(function (k) {
      return '<button class="kid-switch-row" style="width:100%;text-align:left;" data-action="switch-kid" data-id="' + k.id + '">' +
        '<span class="avatar">' + k.avatar + '</span><span class="name">' + esc(k.name) + '</span>' +
        (k.id === data.activeKidId ? '✅' : '') + '</button>';
    }).join('');
    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div><h2>Who\'s playing?</h2>' +
      '<div class="kid-switch-list">' + (rows || '<p class="hint">No kids yet — ask a grown-up to add one in Parent Mode.</p>') + '</div></div></div>';
  }

  function renderCompleteSheet(challengeId) {
    var c = data.challenges.find(function (x) { return x.id === challengeId; });
    if (!c) return '';
    var canSubmit = !c.requiresPhoto || !!pendingPhoto;
    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div>' +
      '<div class="emoji-big">' + (CATEGORY_ICONS[c.category] || '⭐') + '</div>' +
      '<h2>' + esc(c.title) + '</h2>' +
      '<p class="hint" style="text-align:center;">Worth ⭐ ' + c.points + ' points</p>' +
      (c.requiresPhoto ? (
        (pendingPhoto ? '<img class="photo-preview" src="' + pendingPhoto + '" />' : '') +
        '<input type="file" accept="image/*" capture="environment" id="photo-input" style="display:none" />' +
        '<button class="btn btn-outline" data-action="pick-photo">' + (pendingPhoto ? '📷 Retake photo' : '📷 Add photo') + '</button>'
      ) : '') +
      '<div style="height:14px"></div>' +
      '<button class="btn btn-primary" data-action="submit-complete" data-id="' + c.id + '" ' + (canSubmit ? '' : 'disabled') + '>I\'m done!</button>' +
      '<div style="height:8px"></div>' +
      '<button class="btn btn-outline" data-action="close-sheet">Cancel</button>' +
      '</div></div>';
  }

  function renderPendingSheet(challengeId) {
    var c = data.challenges.find(function (x) { return x.id === challengeId; });
    if (!c) return '';
    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div><div class="emoji-big">⏳</div><h2>Waiting for approval</h2>' +
      '<p class="hint" style="text-align:center;">A grown-up needs to check &quot;' + esc(c.title) + '&quot; before you get your points.</p>' +
      '<button class="btn btn-outline" data-action="undo-complete" data-id="' + c.id + '">Undo — I\'m not done yet</button>' +
      '<div style="height:8px"></div><button class="btn btn-primary" data-action="close-sheet">OK</button>' +
      '</div></div>';
  }

  function renderCampaignSheet(challengeId) {
    var c = data.challenges.find(function (x) { return x.id === challengeId; });
    var kid = getActiveKid();
    if (!c || !kid) return '';
    var progress = getCampaignProgress(c, kid.id);
    var comp = getCompletion(c.id, kid.id, todayStr());
    var calendar = renderCampaignCalendar(c, kid.id, progress);

    var actionArea;
    if (progress.isComplete) {
      actionArea = '<div class="pill approved" style="justify-content:center;width:100%;box-sizing:border-box;">🏆 Challenge complete!</div>';
    } else if (comp && comp.status === 'pending') {
      actionArea = '<p class="hint" style="text-align:center;">⏳ Waiting for a grown-up to approve today\'s check-in.</p>';
    } else if (comp && comp.status === 'approved') {
      actionArea = '<p class="hint" style="text-align:center;">✅ Today\'s check-in is approved. Come back tomorrow!</p>';
    } else {
      var canSubmit = !c.requiresPhoto || !!pendingPhoto;
      actionArea = (comp && comp.status === 'rejected' ? '<p class="hint" style="text-align:center;">🔁 ' + (comp.rejectReason ? esc(comp.rejectReason) : 'Try again today.') + '</p>' : '') +
        (c.requiresPhoto ? (
          (pendingPhoto ? '<img class="photo-preview" src="' + pendingPhoto + '" />' : '') +
          '<input type="file" accept="image/*" capture="environment" id="photo-input" style="display:none" />' +
          '<button class="btn btn-outline" data-action="pick-photo">' + (pendingPhoto ? '📷 Retake photo' : '📷 Add photo') + '</button><div style="height:10px"></div>'
        ) : '') +
        '<button class="btn btn-primary" data-action="submit-complete" data-id="' + c.id + '" ' + (canSubmit ? '' : 'disabled') + '>Check in today</button>';
    }

    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div>' +
      '<div class="emoji-big">' + (CATEGORY_ICONS[c.category] || '⭐') + '</div>' +
      '<h2>' + esc(c.title) + '</h2>' +
      '<p class="hint" style="text-align:center;">Started ' + formatDateShort(progress.startDate) + ' · ' + progress.approvedCount + ' of ' + progress.total + ' days · 🏆 ' + c.points + ' pts when finished' +
      (progress.remaining > 0 ? ' · ' + progress.remaining + ' to go' : '') + '</p>' +
      calendar +
      '<div style="height:4px"></div>' +
      actionArea +
      '<div style="height:8px"></div>' +
      '<button class="btn btn-outline" data-action="close-sheet">Close</button>' +
      '</div></div>';
  }

  function renderCampaignCalendar(c, kidId, progress) {
    var today = todayStr();
    var start = progress.startDate;
    var plannedEnd = addDaysStr(start, c.durationDays - 1);
    var displayEnd = plannedEnd > today ? plannedEnd : today;
    var d0 = new Date(start + 'T00:00:00');
    var d1 = new Date(displayEnd + 'T00:00:00');
    var totalCells = Math.round((d1 - d0) / 86400000) + 1;
    var leadBlank = weekdayOf(start);
    var headCells = WEEKDAYS.map(function (w) { return '<div class="cal-head">' + w[0] + '</div>'; }).join('');
    var blanks = '';
    for (var i = 0; i < leadBlank; i++) blanks += '<div class="cal-cell cal-blank"></div>';
    var dayCells = '';
    for (var j = 0; j < totalCells; j++) {
      var dateStr = addDaysStr(start, j);
      var comp = getCompletion(c.id, kidId, dateStr);
      var cls = 'cal-cell';
      if (comp && comp.status === 'approved') cls += ' cal-done';
      else if (comp && comp.status === 'pending') cls += ' cal-pending';
      else if (dateStr < today) cls += ' cal-missed';
      else if (dateStr > today) cls += ' cal-future';
      if (dateStr === today) cls += ' cal-today';
      dayCells += '<div class="' + cls + '">' + new Date(dateStr + 'T00:00:00').getDate() + '</div>';
    }
    return '<div class="campaign-calendar">' + headCells + blanks + dayCells + '</div>';
  }

  function renderRedeemSheet(prizeId) {
    var p = data.prizes.find(function (x) { return x.id === prizeId; });
    var kid = getActiveKid();
    if (!p || !kid) return '';
    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div><div class="emoji-big">' + (p.emoji || '🎁') + '</div>' +
      '<h2>Use ⭐ ' + p.cost + ' for ' + esc(p.name) + '?</h2>' +
      '<p class="hint" style="text-align:center;">You\'ll have ⭐ ' + (kid.points - p.cost) + ' left.</p>' +
      '<button class="btn btn-primary" data-action="confirm-redeem" data-id="' + p.id + '">Yes, redeem it!</button>' +
      '<div style="height:8px"></div><button class="btn btn-outline" data-action="close-sheet">Not yet</button>' +
      '</div></div>';
  }

  function renderRejectSheet(completionId) {
    var comp = data.completions.find(function (c) { return c.id === completionId; });
    var c = comp ? data.challenges.find(function (x) { return x.id === comp.challengeId; }) : null;
    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div><h2>Send back &quot;' + esc(c ? c.title : '') + '&quot;?</h2>' +
      '<div class="field"><label>Why? (optional, kid will see this)</label><input type="text" id="reject-reason" placeholder="e.g. Needs a photo" /></div>' +
      '<button class="btn btn-danger" data-action="confirm-reject" data-id="' + completionId + '">Send back to try again</button>' +
      '<div style="height:8px"></div><button class="btn btn-outline" data-action="close-sheet">Cancel</button>' +
      '</div></div>';
  }

  function renderEditKidSheet() {
    var d = kidDraft;
    var avatars = AVATARS.map(function (a) {
      return '<button class="avatar-opt ' + (d.avatar === a ? 'selected' : '') + '" data-action="pick-avatar" data-id="' + a + '">' + a + '</button>';
    }).join('');
    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div><h2>' + (d.id ? 'Edit Kid' : 'Add Kid') + '</h2>' +
      '<div class="field"><label>Name</label><input type="text" id="kid-name-input" value="' + esc(d.name) + '" oninput="window.__dc.updateKidDraft(\'name\', this.value)" placeholder="e.g. Mia" /></div>' +
      '<div class="field"><label>Avatar</label><div class="avatar-picker">' + avatars + '</div></div>' +
      '<button class="btn btn-primary" data-action="save-kid">Save</button>' +
      (d.id ? '<div style="height:8px"></div><button class="btn btn-outline" data-action="delete-kid" data-id="' + d.id + '">Remove Kid</button>' : '') +
      '</div></div>';
  }

  function renderEditChallengeSheet() {
    var d = challengeDraft;
    var categories = Object.keys(CATEGORY_ICONS);
    var isCampaign = !!d.durationDays;
    var isDaily = d.frequency === 'daily';
    var catChips = categories.map(function (cat) {
      return '<button class="chip ' + (d.category === cat ? 'selected' : '') + '" data-action="pick-category" data-id="' + cat + '">' + CATEGORY_ICONS[cat] + ' ' + cat + '</button>';
    }).join('');
    var dayChips = WEEKDAYS.map(function (wd, i) {
      var sel = !isDaily && d.frequency.indexOf(i) !== -1;
      return '<button class="chip ' + (sel ? 'selected' : '') + '" data-action="toggle-frequency-day" data-id="' + i + '">' + wd + '</button>';
    }).join('');
    var kidChips = data.kids.map(function (k) {
      return '<button class="chip ' + (d.assignedKidIds.indexOf(k.id) !== -1 ? 'selected' : '') + '" data-action="toggle-assigned-kid" data-id="' + k.id + '">' + k.avatar + ' ' + esc(k.name) + '</button>';
    }).join('');
    var durationChips = [7, 30, 75, 100].map(function (n) {
      return '<button class="chip ' + (d.durationDays === n ? 'selected' : '') + '" data-action="pick-duration-preset" data-id="' + n + '">' + n + ' days</button>';
    }).join('');
    var frequencySection = isCampaign
      ? '<div class="field"><label>How many days</label><div class="chip-select">' + durationChips + '</div>' +
        '<input type="number" min="2" max="365" id="challenge-duration-input" value="' + (d.durationDays || 30) + '" oninput="window.__dc.updateChallengeDraft(\'durationDays\', parseInt(this.value,10)||30)" style="margin-top:8px;" /></div>' +
        '<div class="field"><label>Start date</label><input type="date" id="challenge-startdate-input" value="' + (d.startDate || '') + '" oninput="window.__dc.updateChallengeDraft(\'startDate\', this.value)" /></div>'
      : '<div class="field"><label>How often</label><div class="chip-select">' +
        '<button class="chip ' + (isDaily ? 'selected' : '') + '" data-action="set-frequency-daily">Every day</button>' + dayChips + '</div></div>';
    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div><h2>' + (d.id ? 'Edit Challenge' : 'Add Challenge') + '</h2>' +
      '<div class="field"><label>Title</label><input type="text" id="challenge-title-input" value="' + esc(d.title) + '" oninput="window.__dc.updateChallengeDraft(\'title\', this.value)" placeholder="e.g. Read 15 minutes" /></div>' +
      '<div class="field"><label>Category</label><div class="chip-select">' + catChips + '</div></div>' +
      '<div class="field"><label>Points' + (isCampaign ? ' (all at once when finished)' : '') + '</label><input type="number" min="1" max="1000" id="challenge-points-input" value="' + d.points + '" oninput="window.__dc.updateChallengeDraft(\'points\', this.value)" /></div>' +
      '<div class="toggle-row"><span>🗓️ Multi-day challenge (30, 75 days...)</span><button class="switch ' + (isCampaign ? 'on' : '') + '" data-action="toggle-campaign"></button></div>' +
      frequencySection +
      '<div class="toggle-row"><span>📷 Require photo proof</span><button class="switch ' + (d.requiresPhoto ? 'on' : '') + '" data-action="toggle-photo-required"></button></div>' +
      '<div class="field"><label>Who\'s this for</label><div class="chip-select">' + (kidChips || '<p class="hint">Add a kid first.</p>') + '</div></div>' +
      (d.id ? '<div class="toggle-row"><span>Active</span><button class="switch ' + (d.active ? 'on' : '') + '" data-action="toggle-challenge-active"></button></div>' : '') +
      '<button class="btn btn-primary" data-action="save-challenge">Save</button>' +
      (d.id ? '<div style="height:8px"></div><button class="btn btn-outline" data-action="delete-challenge" data-id="' + d.id + '">Delete Challenge</button>' : '') +
      '</div></div>';
  }

  function renderEditPrizeSheet() {
    var d = prizeDraft;
    var emojis = PRIZE_EMOJIS.map(function (e) {
      return '<button class="avatar-opt ' + (d.emoji === e ? 'selected' : '') + '" data-action="pick-prize-emoji" data-id="' + e + '">' + e + '</button>';
    }).join('');
    return '<div class="sheet-backdrop" data-action="close-sheet"><div class="sheet" data-action="none">' +
      '<div class="sheet-handle"></div><h2>' + (d.id ? 'Edit Prize' : 'Add Prize') + '</h2>' +
      '<div class="field"><label>Name</label><input type="text" id="prize-name-input" value="' + esc(d.name) + '" oninput="window.__dc.updatePrizeDraft(\'name\', this.value)" placeholder="e.g. Ice cream trip" /></div>' +
      '<div class="field"><label>Icon</label><div class="avatar-picker">' + emojis + '</div></div>' +
      '<div class="field"><label>Cost (points)</label><input type="number" min="1" max="1000" id="prize-cost-input" value="' + d.cost + '" oninput="window.__dc.updatePrizeDraft(\'cost\', this.value)" /></div>' +
      '<div class="toggle-row"><span>🎈 Real-world prize (needs delivery)</span><button class="switch ' + (d.isRealWorld ? 'on' : '') + '" data-action="toggle-prize-realworld"></button></div>' +
      (d.id ? '<div class="toggle-row"><span>Active</span><button class="switch ' + (d.active ? 'on' : '') + '" data-action="toggle-prize-active"></button></div>' : '') +
      '<button class="btn btn-primary" data-action="save-prize">Save</button>' +
      (d.id ? '<div style="height:8px"></div><button class="btn btn-outline" data-action="delete-prize" data-id="' + d.id + '">Delete Prize</button>' : '') +
      '</div></div>';
  }

  // ---------------- Init ----------------

  document.getElementById('app').addEventListener('click', handleClick);
  document.getElementById('app').addEventListener('change', handleChange);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  renderApp();
})();
