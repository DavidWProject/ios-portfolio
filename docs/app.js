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

  function pauseVideo(video, button) {
    video.pause();
    if (button) {
      button.textContent = "Play";
      button.setAttribute("aria-label", button.getAttribute("aria-label").replace("Pause", "Play"));
    }
  }

  function playVideo(video, button) {
    if (reducedMotion.matches) {
      pauseVideo(video, button);
      return;
    }
    video.muted = true;
    video.playbackRate = 1.15;
    const promise = video.play();
    if (promise) promise.catch(() => pauseVideo(video, button));
    if (button) {
      button.textContent = "Pause";
      button.setAttribute("aria-label", button.getAttribute("aria-label").replace("Play", "Pause"));
    }
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

    const progress = projectCount > 1 ? (activeProject / (projectCount - 1)) * 100 : 0;
    scrubberThumb.style.top = `${progress}%`;
    scrubberProgress.style.height = `${progress}%`;
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

  function maybeWrap() {
    if (!cycleHeight || wrapping || dragging) return;
    const middleTop = cardTarget(originals[0]);
    const top = playlist.scrollTop;

    if (top < middleTop - cycleHeight * 0.5) {
      wrapping = true;
      playlist.scrollTop = top + cycleHeight;
      requestAnimationFrame(() => {
        wrapping = false;
      });
    } else if (top > middleTop + cycleHeight * 1.5) {
      wrapping = true;
      playlist.scrollTop = top - cycleHeight;
      requestAnimationFrame(() => {
        wrapping = false;
      });
    }
  }

  function onScroll() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      maybeWrap();
      updateActive();
    });
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

  function projectFromPointer(event) {
    const rect = scrubber.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return Math.round(fraction * (projectCount - 1));
  }

  scrubber.addEventListener("pointerdown", (event) => {
    dragging = true;
    scrubber.setPointerCapture(event.pointerId);
    goToProject(projectFromPointer(event), "auto");
  });

  scrubber.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    goToProject(projectFromPointer(event), "auto");
  });

  function endDrag(event) {
    dragging = false;
    if (scrubber.hasPointerCapture(event.pointerId)) scrubber.releasePointerCapture(event.pointerId);
    updateActive(true);
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
    button.addEventListener("click", () => {
      if (video.paused) playVideo(video, button);
      else pauseVideo(video, button);
    });
    video.addEventListener("click", () => {
      if (video.paused) playVideo(video, button);
      else pauseVideo(video, button);
    });
  });

  playlist.addEventListener("scroll", onScroll, { passive: true });
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
