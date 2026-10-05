// The hero scene loops through four moments: offers go out (p0), Lender A pays (p1),
// the invoice is stamped and the others are told it's taken (p2), then it holds (p3).
const scene = document.getElementById("scene");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const phases = [
  ["p0", 2200],
  ["p1", 1400],
  ["p2", 2600],
  ["p3", 1800],
];

function play(index = 0) {
  const [name, duration] = phases[index];
  scene.classList.remove("p0", "p1", "p2", "p3");
  // Restart CSS animations by forcing a reflow between phases.
  void scene.offsetWidth;
  scene.classList.add(name);
  setTimeout(() => play((index + 1) % phases.length), duration);
}

if (scene) {
  if (reduceMotion) scene.classList.add("p3");
  else play();
}

// The navigation turns solid once the hero has scrolled away.
const nav = document.getElementById("nav");
const updateNav = () => nav.classList.toggle("solid", window.scrollY > 40);
window.addEventListener("scroll", updateNav, { passive: true });
updateNav();

// Sections fade in as they enter the screen.
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add("shown");
      observer.unobserve(entry.target);
    }
  }
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((element, index) => {
  element.style.transitionDelay = `${(index % 4) * 70}ms`;
  observer.observe(element);
});
