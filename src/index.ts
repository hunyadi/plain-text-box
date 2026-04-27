/**
 * Auto-expanding plain text editor with committed and tentative text
 * @author  Levente Hunyadi
 * @remarks Copyright (C) 2026 Levente Hunyadi
 * @remarks Licensed under MIT, see https://opensource.org/licenses/MIT
 * @see     https://github.com/hunyadi/plain-text-box
 **/

function clamp(number: number, min: number, max: number): number {
    return Math.max(min, Math.min(number, max));
}

function getPositiveIntegerAttribute(elem: HTMLElement, attr: string): number | null {
    const value = Number.parseInt(elem.getAttribute(attr) ?? '', 10);
    if (!isNaN(value) && value > 0) {
        return value;
    } else {
        return null;
    }
}

/**
 * Text input component with separated committed and tentative text rendering.
 */
export class PlainTextBox extends HTMLElement {
    static readonly #DEFAULT_MIN_ROWS = 2;
    static readonly #DEFAULT_MAX_ROWS = 5;

    readonly #root: ShadowRoot;

    #container!: HTMLDivElement;
    #visual!: HTMLDivElement;
    #committedTextNode!: HTMLSpanElement;
    #tentativeTextNode!: HTMLSpanElement;
    #editor!: HTMLTextAreaElement;
    #measure!: HTMLDivElement;
    #resizeObserver?: ResizeObserver;

    #committedText: string = '';
    #tentativeText: string = '';
    #placeholder: string = '';
    #minRows = PlainTextBox.#DEFAULT_MIN_ROWS;
    #maxRows = PlainTextBox.#DEFAULT_MAX_ROWS;
    #syncInProgress = false;

    constructor() {
        super();
        this.#root = this.attachShadow({ mode: 'open' });
    }

    connectedCallback(): void {
        this.#createDOM();
        this.#initFromAttributes();
        this.#renderVisual();
        this.#synchronizeSize();
    }

    disconnectedCallback(): void {
        this.#resizeObserver?.disconnect();
    }

    get value(): string {
        return this.#committedText;
    }

    set value(text: string) {
        this.#committedText = text;
        this.#tentativeText = '';
        this.commit();
    }

    get minRows(): number {
        return this.#minRows;
    }

    set minRows(value: number) {
        this.#minRows = Math.max(1, value);
        this.#synchronizeSize();
    }

    get maxRows(): number {
        return this.#maxRows;
    }

    set maxRows(value: number) {
        this.#maxRows = Math.max(1, value);
        this.#synchronizeSize();
    }

    get disabled(): boolean {
        return this.#editor.disabled;
    }

    set disabled(value: boolean) {
        this.#editor.disabled = value;
        this.#container.classList.toggle('disabled', value);
    }

    override focus(options?: FocusOptions): void {
        this.#editor.focus(options);
    }

    setTentativeText(text: string): void {
        this.#tentativeText = text;
        this.#renderVisual();
        this.#synchronizeSize();
    }

    clearTentativeText(): void {
        this.#tentativeText = '';
        this.#renderVisual();
        this.#synchronizeSize();
    }

    commit(): void {
        const text = this.#getComposedText();
        this.#committedText = text;
        this.#tentativeText = '';
        this.#editor.value = text;
        this.#renderVisual();
        this.#synchronizeSize();
    }

    clearAllText(): void {
        this.#committedText = '';
        this.#tentativeText = '';
        this.#editor.value = '';
        this.#minRows = PlainTextBox.#DEFAULT_MIN_ROWS;
        this.#renderVisual();
        this.#synchronizeSize();
    }

    #createDOM(): void {
        const style = document.createElement('style');
        style.textContent = `:host {
display: block;
flex: 1 1 auto;
min-width: 0;
font-family: inherit;
font-size: inherit;
}
* {
box-sizing: border-box;
}
.container {
width: 100%;
}
.stack {
position: relative;
width: 100%;
}
.visual,
.editor,
.measure {
width: 100%;
font-family: inherit;
font-size: inherit;
line-height: 1.5;
white-space: pre-wrap;
overflow-wrap: break-word;
padding: 0;
border: none;
}
.visual {
color: inherit;
min-height: 1.5em;
pointer-events: none;
white-space: pre-wrap;
}
.tentative-text {
opacity: 0.5;
}
.editor {
position: absolute;
inset: 0;
resize: none;
color: transparent;
caret-color: black;
background: transparent;
outline: none;
overflow: hidden;
}
.editor:focus,
.editor:focus-visible {
outline: none;
box-shadow: none;
}
.measure {
position: absolute;
left: 0;
top: 0;
visibility: hidden;
pointer-events: none;
white-space: pre-wrap;
z-index: -1;
}
.disabled .editor {
cursor: not-allowed;
}`;
        this.#root.appendChild(style);

        this.#container = document.createElement('div');
        this.#container.className = 'container';

        const stack = document.createElement('div');
        stack.className = 'stack';

        this.#visual = document.createElement('div');
        this.#visual.className = 'visual';
        this.#visual.setAttribute('aria-hidden', 'true');

        this.#committedTextNode = document.createElement('span');
        this.#committedTextNode.className = 'committed-text';

        this.#tentativeTextNode = document.createElement('span');
        this.#tentativeTextNode.className = 'tentative-text';

        // append a non-breaking space at the end to avoid whitespace trimming (empty last line)
        this.#visual.append(this.#committedTextNode, this.#tentativeTextNode, document.createTextNode('\u00a0'));

        this.#editor = document.createElement('textarea');
        this.#editor.className = 'editor';
        this.#editor.name = 'message';
        this.#editor.rows = 2;
        this.#editor.addEventListener('input', () => this.#handleEditorInput());
        this.#editor.addEventListener('scroll', () => this.#handleEditorScroll());

        this.#measure = document.createElement('div');
        this.#measure.className = 'measure';
        this.#measure.setAttribute('aria-hidden', 'true');

        if (typeof ResizeObserver !== 'undefined') {
            this.#resizeObserver = new ResizeObserver(() => {
                if (!this.#syncInProgress) {
                    this.#synchronizeSize();
                }
            });
            this.#resizeObserver.observe(this.#editor);
            this.#resizeObserver.observe(this.#visual);
        }

        stack.appendChild(this.#visual);
        stack.appendChild(this.#editor);
        stack.appendChild(this.#measure);
        this.#container.appendChild(stack);
        this.#root.appendChild(this.#container);
    }

    #initFromAttributes(): void {
        const minRows = getPositiveIntegerAttribute(this, 'min-rows');
        if (minRows) {
            this.minRows = minRows;
        }

        const maxRows = getPositiveIntegerAttribute(this, 'max-rows');
        if (maxRows) {
            this.maxRows = maxRows;
        }

        const placeholder = this.getAttribute('placeholder');
        if (placeholder) {
            this.#placeholder = placeholder;
            this.#editor.placeholder = placeholder;
        }

        if (this.hasAttribute('disabled')) {
            this.disabled = true;
        }
    }

    #handleEditorInput(): void {
        this.#committedText = this.#editor.value;
        this.#renderVisual();
        this.#synchronizeSize();
        this.#handleEditorScroll();
        this.#dispatchInputEvent();
    }

    #handleEditorScroll(): void {
        this.#visual.scrollTop = this.#editor.scrollTop;
    }

    #renderVisual(): void {
        this.#committedTextNode.textContent = this.#committedText;
        this.#tentativeTextNode.textContent = this.#tentativeText;
        if (this.#tentativeText) {
            this.#editor.placeholder = '';
        } else {
            this.#editor.placeholder = this.#placeholder;
        }
        this.#handleEditorScroll();
    }

    #getComposedText(): string {
        return `${this.#committedText}${this.#tentativeText}`;
    }

    #synchronizeSize(): void {
        if (!this.#measure || !this.#editor || !this.#visual) {
            return;
        }
        this.#syncInProgress = true;

        const composedText = this.#getComposedText();
        this.#measure.style.height = 'auto';
        this.#measure.textContent = composedText + '\u00a0';

        const editorComputedStyle = window.getComputedStyle(this.#editor);
        const lineHeight = Number.parseFloat(editorComputedStyle.lineHeight) || 24;
        const minHeight = this.#minRows * lineHeight;
        const maxHeight = this.#maxRows * lineHeight;
        const contentHeight = this.#measure.scrollHeight;
        const nextHeight = clamp(contentHeight, minHeight, maxHeight);

        const heightPx = `${nextHeight}px`;
        this.#visual.style.height = heightPx;
        this.#editor.style.height = heightPx;
        this.#measure.style.height = heightPx;

        const overflow = contentHeight > maxHeight ? 'auto' : 'hidden';
        this.#editor.style.overflowY = overflow;
        this.#visual.style.overflowY = overflow;
        this.#handleEditorScroll();

        this.#syncInProgress = false;
    }

    #dispatchInputEvent(): void {
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
}

export function registerPlainTextBox(): void {
    if (!customElements.get('plain-text-box')) {
        customElements.define('plain-text-box', PlainTextBox);
    }
}
