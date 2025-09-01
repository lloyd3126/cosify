// Re-entrant body scroll lock with scrollbar width compensation to prevent layout shift

const ATTR_COUNT = "data-scroll-lock-count";
const ATTR_ORIG_PR = "data-scroll-lock-orig-pr"; // original computed padding-right (number)
const ATTR_ORIG_OV = "data-scroll-lock-orig-ov"; // original inline overflow
const ATTR_ORIG_OVY = "data-scroll-lock-orig-ovy"; // original inline overflowY

function getDocEl() {
    return typeof document !== "undefined" ? document.documentElement : null;
}

export function lockBodyScroll() {
    if (typeof window === "undefined") return;
    const docEl = getDocEl();
    if (!docEl) return;
    const body = document.body;
    const count = parseInt(docEl.getAttribute(ATTR_COUNT) || "0", 10);

    if (count === 0) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        const cs = window.getComputedStyle(body);
        const pr = parseFloat(cs.paddingRight || "0") || 0;
        // store originals
        docEl.setAttribute(ATTR_ORIG_PR, String(pr));
        docEl.setAttribute(ATTR_ORIG_OV, body.style.overflow || "");
        docEl.setAttribute(ATTR_ORIG_OVY, body.style.overflowY || "");

        if (scrollbarWidth > 0) {
            body.style.paddingRight = `${pr + scrollbarWidth}px`;
        }
        body.style.overflow = "hidden";
    }

    docEl.setAttribute(ATTR_COUNT, String(count + 1));
}

export function unlockBodyScroll() {
    if (typeof window === "undefined") return;
    const docEl = getDocEl();
    if (!docEl) return;
    const body = document.body;
    const count = parseInt(docEl.getAttribute(ATTR_COUNT) || "0", 10);

    if (count <= 1) {
        const origPr = parseFloat(docEl.getAttribute(ATTR_ORIG_PR) || "0") || 0;
        const origOv = docEl.getAttribute(ATTR_ORIG_OV) || "";
        const origOvY = docEl.getAttribute(ATTR_ORIG_OVY) || "";

        // Restore padding-right
        if (origPr > 0) {
            body.style.paddingRight = `${origPr}px`;
        } else {
            body.style.paddingRight = "";
        }
        // Restore overflow/overflowY inline values
        body.style.overflow = origOv;
        body.style.overflowY = origOvY;

        docEl.removeAttribute(ATTR_ORIG_PR);
        docEl.removeAttribute(ATTR_ORIG_OV);
        docEl.removeAttribute(ATTR_ORIG_OVY);
        docEl.setAttribute(ATTR_COUNT, "0");
    } else {
        docEl.setAttribute(ATTR_COUNT, String(count - 1));
    }
}
