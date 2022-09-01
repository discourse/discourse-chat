import { isTesting } from "discourse-common/config/environment";

// return true when the browser viewport is zoomed
export default function isZoomed() {
  return (
    !isTesting() &&
    document.documentElement.clientWidth / window.innerWidth !== 1
  );
}
