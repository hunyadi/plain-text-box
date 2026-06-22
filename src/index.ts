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

function getPositiveIntegerValue(str: string): number | null {
    const value = Number.parseInt(str, 10);
    if (!isNaN(value) && value > 0) {
        return value;
    } else {
        return null;
    }
}

function getPositiveIntegerAttribute(elem: HTMLElement, attr: string): number | null {
    return getPositiveIntegerValue(elem.getAttribute(attr) ?? '');
}

/**
 * Text input component with separated committed and tentative text rendering.
 */
export class PlainTextBox extends HTMLElement {
    static readonly #DEFAULT_MIN_ROWS = 2;
    static readonly #DEFAULT_MAX_ROWS = 5;

    static get observedAttributes(): string[] {
        return ['min-rows', 'max-rows', 'max-length', 'placeholder', 'disabled', 'readonly'];
    }

    readonly #root: ShadowRoot;

    #container: HTMLDivElement;
    #visual: HTMLDivElement;
    #committedTextNode: HTMLSpanElement;
    #tentativeTextNode: HTMLSpanElement;
    #editor: HTMLTextAreaElement;
    #measure: HTMLDivElement;
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

        const style = document.createElement('style');
        style.textContent = /*css*/ `:host {
display: block;
flex: 1 1 auto;
min-width: 0;
font-family: inherit;
font-size: inherit;
--text-color-base: currentColor;
--text-color-active: var(--text-color-base);
--text-color-inactive: rgba(from var(--text-color-base) r g b / 0.5);
--text-color-tentative: rgba(from var(--text-color-base) r g b / 0.5);
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
color: var(--text-color-active);
min-height: 1.5em;
pointer-events: none;
white-space: pre-wrap;
}
.committed-text {
color: var(--text-color-active);
}
.tentative-text {
color: var(--text-color-tentative);
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
.disabled .committed-text {
color: var(--text-color-inactive);
}
.disabled .tentative-text {
color: var(--text-color-inactive);
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
        }

        stack.appendChild(this.#visual);
        stack.appendChild(this.#editor);
        stack.appendChild(this.#measure);
        this.#container.appendChild(stack);
        this.#root.appendChild(this.#container);
    }

    connectedCallback(): void {
        this.#observeResizeTargets();
        this.#initFromAttributes();
        this.#renderVisual();
        this.#synchronizeSize();
    }

    disconnectedCallback(): void {
        this.#unobserveResizeTargets();
    }

    connectedMoveCallback(): void {
        this.#unobserveResizeTargets();
        this.#observeResizeTargets();
        this.#synchronizeSize();
    }

    adoptedCallback(): void {
        this.#unobserveResizeTargets();
        this.#observeResizeTargets();
        this.#synchronizeSize();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (newValue === oldValue) {
            return;
        }

        switch (name) {
            case 'min-rows': {
                const minRows = newValue ? getPositiveIntegerValue(newValue) : null;
                if (minRows !== null) {
                    this.minRows = minRows;
                }
                break;
            }
            case 'max-rows': {
                const maxRows = newValue ? getPositiveIntegerValue(newValue) : null;
                if (maxRows !== null) {
                    this.maxRows = maxRows;
                }
                break;
            }
            case 'max-length': {
                this.maxLength = newValue ? getPositiveIntegerValue(newValue) : null;
                break;
            }
            case 'placeholder': {
                this.#placeholder = newValue ?? '';
                this.#renderVisual();
                break;
            }
            case 'disabled': {
                this.disabled = newValue !== null;
                break;
            }
            case 'readonly': {
                this.readOnly = newValue !== null;
                break;
            }
        }
    }

    /**
     * Gets the committed text content of the editor, which represents the finalized input from the user. Tentative text is not included in this value.
     */
    get value(): string {
        return this.#committedText;
    }

    /**
     * Sets the committed text and clears any existing tentative text, updates the visual rendering, and synchronizes the size accordingly.
     */
    set value(text: string) {
        this.#committedText = text;
        this.#tentativeText = '';
        this.commit();
    }

    /**
     * Gets the minimum number of visible rows for the editor. If the content is less than this limit, the editor will expand to meet the minimum rows.
     */
    get minRows(): number {
        return this.#minRows;
    }

    /**
     * Sets the minimum number of visible rows for the editor. If the content is less than this limit, the editor will expand to meet the minimum rows.
     */
    set minRows(value: number) {
        this.#minRows = Math.max(1, value);
        this.#synchronizeSize();
    }

    /**
     * Gets the maximum number of visible rows for the editor. If the content exceeds this limit, a scrollbar will appear.
     */
    get maxRows(): number {
        return this.#maxRows;
    }

    /**
     * Sets the maximum number of visible rows for the editor. If the content exceeds this limit, a scrollbar will appear.
     */
    set maxRows(value: number) {
        this.#maxRows = Math.max(1, value);
        this.#synchronizeSize();
    }

    /**
     * Gets the maximum allowed length of the committed text. If `null`, there is no maximum length constraint.
     */
    get maxLength(): number | null {
        if (this.#editor.hasAttribute('maxlength')) {
            return this.#editor.maxLength;
        } else {
            return null;
        }
    }

    /**
     * Sets the maximum allowed length of the committed text. If set to `null`, there is no maximum length constraint.
     * @param value The maximum length to set, or `null` for no constraint.
     */
    set maxLength(value: number | null) {
        if (value) {
            this.#editor.maxLength = value;
        } else {
            this.#editor.removeAttribute('maxlength');
        }
    }

    /**
     * Gets the disabled state of the editor.
     */
    get disabled(): boolean {
        return this.#editor.disabled;
    }

    /**
     * Sets the disabled state of the editor. Disabled state makes the editor non-interactive.
     */
    set disabled(value: boolean) {
        this.#editor.disabled = value;
        this.#container.classList.toggle('disabled', value);
    }

    /**
     * Gets the read-only state of the editor.
     */
    get readOnly(): boolean {
        return this.#editor.readOnly;
    }

    /**
     * Sets the read-only state of the editor. Read-only state allows text selection and copying but prevents modifying text.
     */
    set readOnly(value: boolean) {
        this.#editor.readOnly = value;
        this.#container.classList.toggle('readonly', value);
    }

    override focus(options?: FocusOptions): void {
        this.#editor.focus(options);
    }

    /**
     * Sets the tentative text, updates the visual rendering, and synchronizes the size accordingly.
     * @param text The tentative text to set.
     */
    setTentativeText(text: string): void {
        this.#tentativeText = text;
        this.#renderVisual();
        this.#synchronizeSize();
    }

    /**
     * Clears the tentative text, updates the visual rendering, and synchronizes the size accordingly.
     */
    clearTentativeText(): void {
        this.#tentativeText = '';
        this.#renderVisual();
        this.#synchronizeSize();
    }

    /**
     * Finalizes the tentative text as committed text, updates the visual rendering, and synchronizes the size accordingly.
     */
    commit(): void {
        const text = this.#getComposedText();
        this.#committedText = text;
        this.#tentativeText = '';
        this.#editor.value = text;
        this.#renderVisual();
        this.#synchronizeSize();
    }

    /**
     * Clears both the committed and tentative text, resets the editor content, and updates the size accordingly.
     */
    clearAllText(): void {
        this.#committedText = '';
        this.#tentativeText = '';
        this.#editor.value = '';
        this.#renderVisual();
        this.#synchronizeSize();
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

        this.maxLength = getPositiveIntegerAttribute(this, 'max-length');

        const placeholder = this.getAttribute('placeholder');
        if (placeholder) {
            this.#placeholder = placeholder;
            this.#editor.placeholder = placeholder;
        }

        if (this.hasAttribute('disabled')) {
            this.disabled = true;
        }

        if (this.hasAttribute('readonly')) {
            this.readOnly = true;
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

    #observeResizeTargets(): void {
        this.#resizeObserver?.observe(this.#editor);
        this.#resizeObserver?.observe(this.#visual);
    }

    #unobserveResizeTargets(): void {
        this.#resizeObserver?.disconnect();
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

    /**
     * Synchronizes the size of the editor, visual, and measure elements based on the current text content and row constraints.
     */
    #synchronizeSize(): void {
        this.#syncInProgress = true;

        const composedText = this.#getComposedText();
        this.#measure.style.height = 'auto';
        // append a non-breaking space at the end to avoid whitespace trimming (empty last line)
        this.#measure.textContent = composedText + '\u00a0';

        const editorComputedStyle = window.getComputedStyle(this.#editor);
        const lineHeight = Number.parseFloat(editorComputedStyle.lineHeight) || 24;
        const minHeight = this.#minRows * lineHeight;
        const maxHeight = this.#maxRows * lineHeight;
        const contentHeight = this.#measure.scrollHeight;
        const targetHeight = clamp(contentHeight, minHeight, maxHeight);

        const heightPx = `${targetHeight}px`;
        this.#visual.style.height = heightPx;
        this.#editor.style.height = heightPx;
        this.#measure.style.height = heightPx;

        const overflow = contentHeight > maxHeight ? 'auto' : 'hidden';
        this.#editor.style.overflowY = overflow;
        this.#visual.style.overflowY = overflow;
        this.#handleEditorScroll();

        this.#syncInProgress = false;
    }

    /**
     * Dispatches an `input` event from the component root to notify external listeners about changes in the committed text.
     */
    #dispatchInputEvent(): void {
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
}

/**
 * Registers the `<plain-text-box>` custom element if it is not already defined.
 */
export function registerPlainTextBox(): void {
    if (!customElements.get('plain-text-box')) {
        customElements.define('plain-text-box', PlainTextBox);
    }
}
