import Script from "next/script";

/** MetaMask (and other extensions) inject into every page and reject on connect.
 *  Next's dev overlay treats that as an app crash. Swallow extension errors early. */
export function IgnoreExtensionErrors() {
  return (
    <Script id="ignore-extension-errors" strategy="beforeInteractive">
      {`(function () {
  function fromExtension(ev) {
    var reason = ev.reason || ev.error || "";
    var msg = (reason && reason.message) ? String(reason.message) : String(reason);
    var stack = (reason && reason.stack) ? String(reason.stack) : "";
    var file = ev.filename ? String(ev.filename) : "";
    return /metamask|failed to connect to metamask|chrome-extension:\\/\\/|moz-extension:\\/\\//i.test(
      msg + " " + stack + " " + file
    );
  }
  window.addEventListener("unhandledrejection", function (ev) {
    if (fromExtension(ev)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener("error", function (ev) {
    if (fromExtension(ev)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  }, true);
})();`}
    </Script>
  );
}
