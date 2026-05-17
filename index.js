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
    const disableButton = document.getElementById('button-disable');
    disableButton.textContent = editor.disabled ? disableButton.dataset['on'] : disableButton.dataset['off'];
    disableButton.addEventListener('click', () => {
        editor.disabled = !editor.disabled;
        disableButton.textContent = editor.disabled ? disableButton.dataset['on'] : disableButton.dataset['off'];
    });
    const readOnlyButton = document.getElementById('button-readonly');
    readOnlyButton.textContent = editor.readOnly ? readOnlyButton.dataset['on'] : readOnlyButton.dataset['off'];
    readOnlyButton.addEventListener('click', () => {
        editor.readOnly = !editor.readOnly;
        readOnlyButton.textContent = editor.readOnly ? readOnlyButton.dataset['on'] : readOnlyButton.dataset['off'];
    });
    const minRowsTextBox = document.getElementById('input-min-rows');
    minRowsTextBox.value = editor.minRows;
    minRowsTextBox.addEventListener('input', (e) => {
        editor.minRows = e.target.value;
    });
    const maxRowsTextBox = document.getElementById('input-max-rows');
    maxRowsTextBox.value = editor.maxRows;
    maxRowsTextBox.addEventListener('input', (e) => {
        editor.maxRows = e.target.value;
    });
    const maxLengthTextBox = document.getElementById('input-max-length');
    maxLengthTextBox.value = editor.maxLength;
    maxLengthTextBox.addEventListener('input', (e) => {
        const value = Number.parseInt(e.target.value ?? '', 10);
        if (!isNaN(value) && value > 0) {
            editor.maxLength = value;
        } else {
            editor.maxLength = null;
        }
    });
});
