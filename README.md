# Auto-expanding plain text editor with tentative text

When offering an editable text area to users that is augmented with a service such as an AI assistant, code completion or speech recognition, we need to distinguish between committed text (typed or accepted by the user) and tentative text (code completion prompt or provisional text emitted by speech recognition). While many applications with rich text editors have this capability, this web component offers a simple solution with minimal dependencies.

Refer to the [demo page](https://hunyadi.github.io/plain-text-box/index.html) for an interactive example.

## Installation

```bash
npm install plain-text-box
```

## Usage

### Register web component

```javascript
import { registerPlainTextBox } from "plain-text-box";

document.addEventListener("DOMContentLoaded", () => {
    registerPlainTextBox();
});
```

### Connect web component

```html
<plain-text-box disabled max-rows="5" min-rows="2"
    placeholder="Type text here...">
</plain-text-box>
```

### Use CSS variables to customize appearance

```css
plain-text-box {
    border: thin solid black;
    border-radius: 10px;
    padding: 5px;
    max-width: 100%;
    width: 640px;
    --text-color-active: blue;
    --text-color-inactive: lightgray;
    --text-color-tentative: gray;
}
```

## Internals

Structurally, the web component encapsulates an HTML `<textarea>` element that intercepts user input and a `<div>` element that is responsible for visualization. The characters typed into `<textarea>` are invisible but immediately appear in the `<div>` element. While a `<textarea>` can only have a single font color and size, a `<div>` allows us to fine-tune formatting, and apply a darker color to committed text and a lighter color to tentative text.
