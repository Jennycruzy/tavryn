// The hero invoice loops: offers out, Lender A pays, the invoice is stamped and the
// other lenders are told it's gone, then it resets.
const scene = document.getElementById("scene");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function cycle() {
  scene.classList.remove("scene-paying", "scene-done");
  setTimeout(() => scene.classList.add("scene-paying"), 1800);
  setTimeout(() => {
    scene.classList.remove("scene-paying");
    scene.classList.add("scene-done");
  }, 3000);
  setTimeout(cycle, 8000);
}
if (scene) {
  if (reduceMotion) scene.classList.add("scene-done");
  else cycle();
}

// A rule under the masthead once the page scrolls.
const nav = document.getElementById("nav");
const updateNav = () => nav.classList.toggle("solid", window.scrollY > 8);
window.addEventListener("scroll", updateNav, { passive: true });
updateNav();

// The DevNet record prints line by line when it comes into view.
function printLog(log) {
  log.querySelectorAll("li").forEach((line, index) => {
    setTimeout(() => line.classList.add("on"), reduceMotion ? 0 : 280 * index);
  });
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("shown");
    if (entry.target.id === "log") printLog(entry.target);
    observer.unobserve(entry.target);
  }
}, { threshold: 0.2 });
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
