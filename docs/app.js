(() => {
  const playlist = document.querySelector("#playlist");
  const scrubber = document.querySelector("#scrubber");
  const scrubberThumb = document.querySelector("#scrubberThumb");
  const scrubberProgress = document.querySelector("#scrubberProgress");
  const scrubberNumber = document.querySelector("#scrubberNumber");
  const scrubberName = document.querySelector("#scrubberName");
  const announcement = document.querySelector("#projectAnnouncement");
  const previousButton = document.querySelector("#previousProject");
  const nextButton = document.querySelector("#nextProject");
  const identity = document.querySelector(".identity");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!playlist || !scrubber) return;

  const originals = Array.from(playlist.querySelectorAll(":scope > .project-card"));
  const projectCount = originals.length;
  const projectNames = originals.map((card) => card.dataset.name || "Project");
  const projectIds = originals.map((card) => card.id);
  let allCards = [];
  let activeCard = null;
  let activeProject = 0;
  let cycleHeight = 0;
  let frameRequested = false;
  let wrapping = false;
  let dragging = false;
  let resizeTimer;
  let scrollEndTimer;
  const playbackTokens = new WeakMap();

  function makeClone(card, cycle) {
    const clone = card.cloneNode(true);
    clone.classList.add("is-clone");
    clone.dataset.cycle = cycle;
    clone.removeAttribute("id");
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    clone.querySelectorAll("button, video, a").forEach((node) => {
      node.tabIndex = -1;
    });
    return clone;
  }

  const before = originals.map((card) => makeClone(card, "before"));
  const after = originals.map((card) => makeClone(card, "after"));
  const beforeFragment = document.createDocumentFragment();
  const afterFragment = document.createDocumentFragment();
  before.forEach((card) => beforeFragment.append(card));
  after.forEach((card) => afterFragment.append(card));
  playlist.prepend(beforeFragment);
  playlist.append(afterFragment);
  originals.forEach((card) => {
    card.dataset.cycle = "middle";
  });
  allCards = Array.from(playlist.querySelectorAll(":scope > .project-card"));

  function cardTarget(card) {
    return card.offsetTop - (playlist.clientHeight - card.offsetHeight) / 2;
  }

  function measureCycle() {
    cycleHeight = cardTarget(after[0]) - cardTarget(originals[0]);
  }

  function nearestCard() {
    const viewportCenter = playlist.scrollTop + playlist.clientHeight / 2;
    let nearest = allCards[0];
    let distance = Number.POSITIVE_INFINITY;

    allCards.forEach((card) => {
      const center = card.offsetTop + card.offsetHeight / 2;
      const nextDistance = Math.abs(center - viewportCenter);
      if (nextDistance < distance) {
        nearest = card;
        distance = nextDistance;
      }
    });

    return nearest;
  }

  function setTheme(card) {
    const styles = getComputedStyle(card);
    const accent = styles.getPropertyValue("--accent").trim();
    const accentRgb = styles.getPropertyValue("--accent-rgb").trim();
    if (accent) document.documentElement.style.setProperty("--accent", accent);
    if (accentRgb) document.documentElement.style.setProperty("--accent-rgb", accentRgb);
  }

  function setVideoButton(button, state) {
    if (!button) return;
    const currentLabel = button.getAttribute("aria-label") || "Trailer";
    const trailerName = currentLabel.replace(/^(Play|Pause|Loading) /, "");
    button.textContent = state === "Loading" ? "Loading…" : state;
    button.setAttribute("aria-label", `${state} ${trailerName}`);
  }

  function pauseVideo(video, button) {
    playbackTokens.set(video, (playbackTokens.get(video) || 0) + 1);
    video.pause();
    setVideoButton(button, "Play");
  }

  function playVideo(video, button, manual = false) {
    if (reducedMotion.matches && !manual) {
      pauseVideo(video, button);
      return;
    }

    const token = (playbackTokens.get(video) || 0) + 1;
    playbackTokens.set(video, token);
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.playbackRate = 1.15;
    setVideoButton(button, video.readyState >= 2 ? "Pause" : "Loading");

    const promise = video.play();
    if (!promise) {
      setVideoButton(button, "Pause");
      return;
    }

    promise
      .then(() => {
        if (playbackTokens.get(video) === token && !video.paused) setVideoButton(button, "Pause");
      })
      .catch(() => {
        if (playbackTokens.get(video) === token) setVideoButton(button, "Play");
      });
  }

  function syncVideos(card) {
    allCards.forEach((candidate) => {
      const video = candidate.querySelector("video");
      const button = candidate.querySelector(".video-toggle");
      if (!video) return;
      if (candidate === card) playVideo(video, button);
      else pauseVideo(video, button);
    });
  }

  function updateActive(forceAnnouncement = false) {
    const nextActive = nearestCard();
    const nextProject = Number(nextActive.dataset.project || 0);
    const changed = nextActive !== activeCard;
    activeCard = nextActive;
    activeProject = nextProject;

    allCards.forEach((card, index) => {
      const activeIndex = allCards.indexOf(activeCard);
      card.classList.toggle("is-active", card === activeCard);
      card.classList.toggle("is-near", Math.abs(index - activeIndex) === 1);
    });

    if (!dragging) setScrubberPosition(50);
    scrubberNumber.textContent = String(activeProject + 1).padStart(2, "0");
    scrubberName.textContent = projectNames[activeProject];
    scrubber.setAttribute("aria-valuenow", String(activeProject + 1));
    scrubber.setAttribute("aria-valuetext", projectNames[activeProject]);
    setTheme(activeCard);

    if (changed) {
      syncVideos(activeCard);
      const newHash = `#${projectIds[activeProject]}`;
      if (window.location.hash !== newHash) history.replaceState(null, "", newHash);
    }

    if ((changed || forceAnnouncement) && announcement) {
      announcement.textContent = `${String(activeProject + 1).padStart(2, "0")} of ${String(projectCount).padStart(2, "0")}: ${projectNames[activeProject]}`;
    }
  }

  function carryVideoFrame(sourceCard, destinationCard) {
    const sourceVideo = sourceCard?.querySelector("video");
    const destinationVideo = destinationCard?.querySelector("video");
    if (!sourceVideo || !destinationVideo || !Number.isFinite(sourceVideo.currentTime)) return;

    try {
      destinationVideo.currentTime = sourceVideo.currentTime;
    } catch {
      // The destination trailer will begin normally if its metadata is not ready yet.
    }
  }

  function maybeWrap() {
    if (!cycleHeight || wrapping || dragging) return false;
    const middleTop = cardTarget(originals[0]);
    const top = playlist.scrollTop;
    let offset = 0;

    if (top < middleTop - cycleHeight * 0.5) {
      offset = cycleHeight;
    } else if (top > middleTop + cycleHeight * 1.5) {
      offset = -cycleHeight;
    }

    if (!offset) return false;

    const sourceCard = nearestCard();
    const destinationCard = originals[Number(sourceCard.dataset.project || 0)];
    carryVideoFrame(sourceCard, destinationCard);

    wrapping = true;
    playlist.classList.add("is-recentering");
    playlist.scrollTop = top + offset;
    updateActive();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        playlist.classList.remove("is-recentering");
        wrapping = false;
      });
    });
    return true;
  }

  function finishScroll() {
    clearTimeout(scrollEndTimer);
    if (wrapping || dragging) return;
    if (!maybeWrap()) updateActive();
  }

  function scheduleScrollEnd() {
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(finishScroll, 220);
  }

  function onScroll() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      updateActive();
      const activeVideo = activeCard?.querySelector("video");
      const activeButton = activeCard?.querySelector(".video-toggle");
      if (activeVideo?.paused && activeVideo.readyState >= 2) playVideo(activeVideo, activeButton);
      scheduleScrollEnd();
    });
  }

  function setScrubberPosition(percent) {
    const position = Math.min(100, Math.max(0, percent));
    scrubberThumb.style.top = `${position}%`;
    scrubberProgress.style.top = `${Math.min(84, Math.max(0, position - 8))}%`;
    scrubberProgress.style.height = "16%";
  }

  function pointerPosition(event) {
    const rect = scrubber.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return {
      percent: fraction * 100,
      project: Math.round(fraction * (projectCount - 1)),
    };
  }

  function scrollToCard(card, behavior = "smooth") {
    playlist.scrollTo({ top: cardTarget(card), behavior });
  }

  function closestCopy(projectIndex) {
    const matches = allCards.filter((card) => Number(card.dataset.project) === projectIndex);
    const current = playlist.scrollTop;
    return matches.reduce((nearest, candidate) => {
      return Math.abs(cardTarget(candidate) - current) < Math.abs(cardTarget(nearest) - current)
        ? candidate
        : nearest;
    });
  }

  function goToProject(projectIndex, behavior = "smooth") {
    const wrapped = (projectIndex + projectCount) % projectCount;
    scrollToCard(closestCopy(wrapped), behavior);
  }

  function moveOne(direction) {
    const currentIndex = allCards.indexOf(nearestCard());
    const nextIndex = Math.min(allCards.length - 1, Math.max(0, currentIndex + direction));
    scrollToCard(allCards[nextIndex]);
  }

  scrubber.addEventListener("pointerdown", (event) => {
    dragging = true;
    scrubber.classList.add("is-dragging");
    scrubber.setPointerCapture(event.pointerId);
    const position = pointerPosition(event);
    setScrubberPosition(position.percent);
    goToProject(position.project, "auto");
  });

  scrubber.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const position = pointerPosition(event);
    setScrubberPosition(position.percent);
    goToProject(position.project, "auto");
  });

  function endDrag(event) {
    dragging = false;
    scrubber.classList.remove("is-dragging");
    if (scrubber.hasPointerCapture(event.pointerId)) scrubber.releasePointerCapture(event.pointerId);
    updateActive(true);
    scheduleScrollEnd();
  }

  scrubber.addEventListener("pointerup", endDrag);
  scrubber.addEventListener("pointercancel", endDrag);

  scrubber.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      goToProject(activeProject + 1);
    } else if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
      event.preventDefault();
      goToProject(activeProject - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToProject(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToProject(projectCount - 1);
    }
  });

  previousButton?.addEventListener("click", () => moveOne(-1));
  nextButton?.addEventListener("click", () => moveOne(1));
  identity?.addEventListener("click", (event) => {
    event.preventDefault();
    goToProject(0);
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLButtonElement || event.target === scrubber) return;
    if (["ArrowDown", "PageDown"].includes(event.key)) {
      event.preventDefault();
      moveOne(1);
    } else if (["ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      moveOne(-1);
    }
  });

  allCards.forEach((card) => {
    const video = card.querySelector("video");
    const button = card.querySelector(".video-toggle");
    if (!video || !button) return;
    video.preload = "auto";
    button.addEventListener("click", () => {
      if (video.paused) playVideo(video, button, true);
      else pauseVideo(video, button);
    });
    video.addEventListener("click", () => {
      if (video.paused) playVideo(video, button, true);
      else pauseVideo(video, button);
    });
    video.addEventListener("canplay", () => {
      if (card === activeCard && video.paused) playVideo(video, button);
    });
    video.addEventListener("playing", () => {
      if (card === activeCard) setVideoButton(button, "Pause");
    });
    video.addEventListener("waiting", () => {
      if (card === activeCard) setVideoButton(button, "Loading");
    });
  });

  playlist.addEventListener("scroll", onScroll, { passive: true });
  playlist.addEventListener("scrollend", finishScroll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      document.querySelectorAll("video").forEach((video) => video.pause());
    } else if (activeCard) {
      syncVideos(activeCard);
    }
  });
  reducedMotion.addEventListener?.("change", () => activeCard && syncVideos(activeCard));

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measureCycle();
      goToProject(activeProject, "auto");
      updateActive();
    }, 120);
  });

  requestAnimationFrame(() => {
    measureCycle();
    const hashIndex = projectIds.indexOf(window.location.hash.slice(1));
    const initialIndex = hashIndex >= 0 ? hashIndex : 0;
    scrollToCard(originals[initialIndex], "auto");
    requestAnimationFrame(() => updateActive(true));
  });
})();
