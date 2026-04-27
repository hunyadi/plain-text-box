import { registerPlainTextBox } from './dist/plain-text-box.js';

document.addEventListener('DOMContentLoaded', () => {
    registerPlainTextBox();

    /** @type {PlainTextBox} */
    const editor = document.getElementById('text-editor');
    /** @type {HTMLTextAreaElement} */
    const tentative = document.getElementById('textarea-tentative');

    document.getElementById('button-set').addEventListener('click', () => {
        editor.setTentativeText(tentative.value);
    });
    document.getElementById('button-commit').addEventListener('click', () => {
        editor.commit();
    });
    document.getElementById('button-clear').addEventListener('click', () => {
        editor.clearTentativeText();
    });
});
