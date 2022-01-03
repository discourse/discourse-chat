import escape from "discourse-common/lib/escape";

export default function collapseLazyYT(onebox) {
  const parent = onebox.parentElement;
  const title = onebox.getAttribute("data-youtube-title");
  const id = onebox.getAttribute("data-youtube-id");

  parent.removeChild(onebox);
  const [text, collapsible] = createCollapsibleToggle(onebox, id, title);
  parent.appendChild(text);
  parent.appendChild(collapsible);
}

function createVideoLink(videoLinkClass, id, title) {
  const link = document.createElement("a");
  link.classList.add(videoLinkClass);
  link.setAttribute("target", "_blank");
  link.setAttribute("href", `https://www.youtube.com/watch?v=${escape(id)}`);
  link.text = title;
  return link;
}

function createSvgIcon(className, direction) {
  const svg = document.createElement("div");
  svg.innerHTML = `<svg class="${className} fa svg-icon" xmlns="http://www.w3.org/2000/svg"><use href="#caret-${direction}"></use></svg>`;
  return svg.firstChild;
}

function createCollapsibleToggle(onebox, id, title) {
  const toggle = document.createElement("span");
  const open = createSvgIcon("lazyYT-collapsible-open", "down");
  const closed = createSvgIcon("lazyYT-collapsible-closed", "right");
  closed.setAttribute("hidden", true);

  toggle.appendChild(createVideoLink("lazyYT-collapsible-link", id, title));
  toggle.appendChild(open);
  toggle.appendChild(closed);

  const collapsibleDiv = document.createElement("div");
  collapsibleDiv.classList.add("lazyYT-collapsible");
  collapsibleDiv.appendChild(onebox);

  closed.addEventListener("click", (e) => {
    e.target.setAttribute("hidden", true);
    open.removeAttribute("hidden");
    collapsibleDiv.removeAttribute("hidden");
  });

  open.addEventListener("click", (e) => {
    e.target.setAttribute("hidden", true);
    closed.removeAttribute("hidden");
    collapsibleDiv.setAttribute("hidden", true);
  });

  return [toggle, collapsibleDiv];
}
