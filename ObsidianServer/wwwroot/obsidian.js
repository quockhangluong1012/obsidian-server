window.obsidian = (() => {
    const math = /\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g;
    const dependencies = [
        ['/lib/marked.min.js', () => window.marked],
        ['/lib/purify.min.js', () => window.DOMPurify],
        ['/lib/highlight.min.js', () => window.hljs],
        ['/lib/katex.min.js', () => window.katex],
        ['/lib/mermaid.min.js', () => window.mermaid]
    ];
    let runtime;

    async function ensureRuntime() {
        runtime ??= (async () => {
            for (const [url, exported] of dependencies) {
                if (exported()) continue;
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error(`Could not load ${url}.`);
                (0, eval)(await response.text());
            }
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        })();
        return runtime;
    }

    function renderMath(source) {
        return source.replace(math, (_, block, inline) => {
            try { return katex.renderToString(block ?? inline, { displayMode: Boolean(block), throwOnError: false }); }
            catch { return block ?? inline; }
        });
    }

    async function renderMermaid(container) {
        for (const block of container.querySelectorAll('code.language-mermaid')) {
            const host = document.createElement('div');
            host.className = 'mermaid';
            host.textContent = block.textContent;
            block.closest('pre').replaceWith(host);
        }
        try { await mermaid.run({ nodes: container.querySelectorAll('.mermaid') }); } catch { }
    }

    async function renderMarkdown(element, markdown) {
        await ensureRuntime();
        const rendered = marked.parse(renderMath(markdown ?? ''), { gfm: true, breaks: true });
        element.innerHTML = DOMPurify.sanitize(rendered, {
            USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
            ADD_ATTR: ['target', 'viewBox', 'preserveAspectRatio']
        });
        element.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
        await renderMermaid(element);
    }

    function reducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function scrollToHeading(container, index) {
        const heading = container.querySelectorAll('h1, h2, h3, h4, h5, h6')[index];
        if (heading) heading.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }

    function focusAndSelect(element) {
        element.focus();
        element.select?.();
    }

    function initTheme() {
        const theme = localStorage.getItem('obsidian-theme') || 'light';
        document.documentElement.dataset.theme = theme;
        return theme;
    }

    function setTheme(theme) {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('obsidian-theme', theme);
    }

    // Sidebar drag handle. Delegated so it survives every Blazor re-render.
    const minWidth = 180;
    const maxWidth = 480;
    document.addEventListener('pointerdown', event => {
        if (!event.target.closest?.('.sidebar-resize')) return;
        event.preventDefault();
        const apply = pointerEvent => {
            const width = Math.min(maxWidth, Math.max(minWidth, Math.round(pointerEvent.clientX)));
            document.documentElement.style.setProperty('--sidebar-w', width + 'px');
            return width;
        };
        const move = pointerEvent => apply(pointerEvent);
        const release = pointerEvent => {
            localStorage.setItem('obsidian-sidebar', apply(pointerEvent));
            document.body.classList.remove('is-resizing');
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', release);
        };
        document.body.classList.add('is-resizing');
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', release);
    });

    async function uploadPastedImage(noteId, folderId) {
        try {
            const clipboard = await navigator.clipboard.read();
            for (const item of clipboard) {
                const type = item.types.find(candidate => candidate.startsWith('image/'));
                if (!type) continue;
                const blob = await item.getType(type);
                const form = new FormData();
                form.append('file', new File([blob], `pasted-${Date.now()}.${type === 'image/svg+xml' ? 'svg' : type.split('/')[1]}`, { type }));
                if (noteId) form.append('noteId', noteId);
                if (folderId) form.append('folderId', folderId);
                const response = await fetch('/api/files', { method: 'POST', body: form });
                if (!response.ok) throw new Error('Upload failed');
                const file = await response.json();
                return `\n![](${file.url})\n`;
            }
        } catch { }
        return null;
    }

    // Global Ctrl/Cmd+K -> opens the command palette from anywhere on the page.
    function bindShortcut(dotNetRef) {
        document.addEventListener('keydown', event => {
            if (!(event.key === 'k' || event.key === 'K') || !(event.ctrlKey || event.metaKey)) return;
            event.preventDefault();
            dotNetRef.invokeMethodAsync('OpenPalette');
        });
    }

    async function copyText(text) {
        try { await navigator.clipboard.writeText(text); return true; }
        catch { return false; }
    }

    return { renderMarkdown, uploadPastedImage, scrollToHeading, initTheme, setTheme, focusAndSelect, bindShortcut, copyText };
})();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));