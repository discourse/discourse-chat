function stringToDOMNode(string) {
  let template = document.createElement("template");
  string = string.trim();
  template.innerHTML = string;
  return template.content.firstChild;
}

export default class BlockKit {
  static decorate(element) {
    return new this(element).init();
  }

  constructor(element) {
    this.element = element;
  }

  init() {
    this.element
      .querySelectorAll(".d-wrap[data-wrap=blocks]")
      .forEach((blocks) => {
        blocks.querySelectorAll(".d-wrap[data-wrap=block]").forEach((block) => {
          const { type } = block.dataset;

          if (type === "context") {
            this._handleElements(block);
          } else if (type === "actions") {
            this._handleElements(block);
          } else if (type === "sections") {
            this._handleElements(block);
          } else {
            this[`_${type}BlockElement`].call(this, block);
          }
        });
      });
  }

  _handleElements(block) {
    block
      .querySelectorAll(".d-wrap[data-wrap=block-element]")
      .forEach((blockElement) => {
        const { type } = blockElement.dataset;
        this[`_${type}BlockElement`].call(this, blockElement);
      });
  }

  _dividerBlockElement(element) {
    element.parentNode.replaceWith(stringToDOMNode("<hr>"));
  }

  _imageBlockElement(element) {
    const { url } = element.dataset;
    element.parentNode.replaceWith(stringToDOMNode(`<img src="${url}">`));
  }

  _buttonBlockElement(element) {
    const { url, style } = element.dataset;
    const button = stringToDOMNode(
      `<a class="btn btn-${
        style || "default"
      }" href="${url}" target="_blank" rel="noopener noreferrer">${
        element.innerText
      }</a>`
    );
    element.replaceWith(button);
  }

  _textBlockElement(element) {
    element.replaceWith(element.querySelector("p"));
  }
}
