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
    disableButton.textContent = editor.disabled ? 'Enable' : 'Disable';
    disableButton.addEventListener('click', () => {
        editor.disabled = !editor.disabled;
        disableButton.textContent = editor.disabled ? 'Enable' : 'Disable';
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
});
