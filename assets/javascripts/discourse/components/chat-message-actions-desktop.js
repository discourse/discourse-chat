import Component from "@ember/component";
import { action } from "@ember/object";
import { createPopper } from "@popperjs/core";
import { schedule } from "@ember/runloop";

export default Component.extend({
  tagName: "",

  messageActions: null,

  didReceiveAttrs() {
    this._super(...arguments);

    this.popper?.destroy();

    schedule("afterRender", () => {
      this.popper = createPopper(
        document.querySelector(
          `.chat-message-container[data-id="${this.message.id}"]`
        ),
        document.querySelector(
          `.chat-msgactions-hover[data-id="${this.message.id}"] .chat-msgactions`
        ),
        {
          placement: "right-start",
          hide: { enabled: true },
          modifiers: [
            {
              name: "offset",
              options: {
                offset: ({ popper, placement }) => {
                  return [
                    2,
                    -(placement.includes("left") || placement.includes("right")
                      ? popper.width + 2
                      : popper.height),
                  ];
                },
              },
            },
          ],
        }
      );
    });
  },

  @action
  handleSecondaryButtons(id) {
    this.messageActions?.[id]?.();
  },
});
