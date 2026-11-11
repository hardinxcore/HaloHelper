// Accessibility module (optional, toggle in extension options).
//
// Halo renders tables, dialogs and button bars as plain <div>s without ARIA roles,
// and its react-select dropdowns announce "option [object Object] focused" to
// screen readers. This module adds the missing roles and rewrites those
// announcements with the real option label.
//
// Based on the SEVENP "Halo PSA" accessibility userscript (2026-05-04).
// Injected on every Halo page by background.js; the guard below keeps it to one
// instance per page.
(async function initHaloA11y() {
    if (window._haloA11yActive) return;
    window._haloA11yActive = true;

    const settings = await chrome.storage.local.get('haloA11yEnabled');
    if (settings.haloA11yEnabled !== true) return;

    // ============================================================
    //  ARIA roles for Halo's div-based UI
    // ============================================================

    // class → attributes. The first matching class (in this order) wins.
    const CLASS_TO_ATTRIBUTES = {
        'rt-table': { role: 'table' },
        'rt-thead': { role: 'rowgroup' },
        'rt-tbody': { role: 'rowgroup' },
        'rt-tr': { role: 'row' },
        'rt-th': { role: 'columnheader' },
        'rt-td': { role: 'cell' },
        'subscreen': { role: 'dialog' },
        'action-history-item': { role: 'article' },
        'buttons-container': { role: 'region', 'aria-label': 'Button container' },
        'rbc-events-container': { role: 'list' },
        'rbc-event': { role: 'listitem' }
    };
    const ROLE_SELECTOR = Object.keys(CLASS_TO_ATTRIBUTES).map(c => '.' + c).join(',');

    function applyAttributesFromClass(el) {
        if (!(el instanceof HTMLElement)) return;
        for (const [className, attributes] of Object.entries(CLASS_TO_ATTRIBUTES)) {
            if (!el.classList.contains(className)) continue;
            for (const [name, value] of Object.entries(attributes)) {
                if (el.getAttribute(name) !== value) el.setAttribute(name, value);
            }
            return;
        }
    }

    function applyAttributesToTree(node) {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(ROLE_SELECTOR)) applyAttributesFromClass(node);
        node.querySelectorAll(ROLE_SELECTOR).forEach(applyAttributesFromClass);
    }

    // ============================================================
    //  react-select announcements ("option [object Object] focused")
    // ============================================================

    // Halo passes a raw option object instead of a string to react-select, so its
    // live region (#aria-context / #aria-selection) announces "[object Object]".
    // Replace that with the focused option's label: primary text from .line-large
    // plus secondary text (department, organisation/site) from .line-small.

    // Select container (or document) → label of the last focused option. Needed for
    // the "selected" announcement: the menu is often already closed by then, so
    // there is no focused option left to read.
    const lastFocusedLabel = new WeakMap();

    function getFocusedOptionLabel(scope) {
        const focused = scope.querySelector('.Select__option--is-focused');
        if (!focused) return null;
        const large = focused.querySelector('.line-large')?.textContent?.trim();
        const small = focused.querySelector('.line-small')?.textContent?.trim();
        if (large && small && small !== large) return `${large}, ${small}`;
        return large || small || focused.textContent.trim() || null;
    }

    function fixReactSelectA11yText(span) {
        if (!(span instanceof HTMLElement)) return;
        if (span.id !== 'aria-context' && span.id !== 'aria-selection') return;

        const scope = span.closest('.Select') || document;
        const focusedLabel = getFocusedOptionLabel(scope);
        if (focusedLabel) lastFocusedLabel.set(scope, focusedLabel);

        const text = span.textContent;
        if (!text || !text.includes('[object Object]')) return;
        const label = focusedLabel || lastFocusedLabel.get(scope);
        if (!label) return;

        const fixed = text.replace(/\[object Object\]/g, label);
        // Setting textContent triggers another mutation; it no longer contains
        // "[object Object]", so that one returns early above.
        if (fixed !== text) span.textContent = fixed;
    }

    // ============================================================
    //  Observer
    // ============================================================

    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'childList') {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        fixReactSelectA11yText(node.parentElement);
                    } else if (node instanceof HTMLElement) {
                        applyAttributesToTree(node);
                        fixReactSelectA11yText(node);
                        node.querySelectorAll('#aria-context, #aria-selection').forEach(fixReactSelectA11yText);
                    }
                });
            } else if (m.type === 'characterData') {
                fixReactSelectA11yText(m.target.parentElement);
            } else if (m.type === 'attributes') {
                // React reuses elements and only swaps className
                applyAttributesFromClass(m.target);
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class']
    });

    // Initial pass for what is already on the page
    applyAttributesToTree(document.body);
    document.querySelectorAll('#aria-context, #aria-selection').forEach(fixReactSelectA11yText);
})();
