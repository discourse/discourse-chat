import Component from "@ember/component";
import { htmlSafe } from "@ember/template";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import { emojiUrlFor } from "discourse/lib/text";
import discourseDebounce from "discourse-common/lib/debounce";
import { INPUT_DELAY } from "discourse-common/config/environment";
import { bind } from "discourse-common/utils/decorators";
import { later, schedule } from "@ember/runloop";

export const FITZPATRICK_MODIFIERS = [
  {
    scale: 1,
    modifier: null,
  },
  {
    scale: 2,
    modifier: ":t2",
  },
  {
    scale: 3,
    modifier: ":t3",
  },
  {
    scale: 4,
    modifier: ":t4",
  },
  {
    scale: 5,
    modifier: ":t5",
  },
  {
    scale: 6,
    modifier: ":t6",
  },
];

export default class ChatEmojiPicker extends Component {
  @service chatEmojiPickerManager;
  @service emojiPickerScrollObserver;
  @service chatEmojiReactionStore;
  tagName = "";
  @tracked filteredEmojis = null;
  @tracked isExpandedFitzpatrickScale = false;
  fitzpatrickModifiers = FITZPATRICK_MODIFIERS;

  get groups() {
    const emojis = this.chatEmojiPickerManager.emojis;
    const favorites = {
      favorites: this.chatEmojiReactionStore.favorites.map((name) => {
        return {
          name,
          group: "favorites",
          url: emojiUrlFor(name),
        };
      }),
    };

    return {
      ...favorites,
      ...emojis,
    };
  }

  get flatEmojis() {
    // eslint-disable-next-line no-unused-vars
    let { favorites, ...rest } = this.chatEmojiPickerManager.emojis;
    return Object.values(rest).flat();
  }

  get navIndicatorStyle() {
    const section = this.chatEmojiPickerManager.lastVisibleSection;
    const index = Object.keys(this.groups).indexOf(section);

    return htmlSafe(
      `width: ${
        100 / Object.keys(this.groups).length
      }%; transform: translateX(${index * 100}%);`
    );
  }

  get navBtnStyle() {
    return htmlSafe(`width: ${100 / Object.keys(this.groups).length}%;`);
  }

  @action
  didPressEscape(event) {
    if (event.key === "Escape") {
      this.chatEmojiPickerManager.close();
    }
  }

  @action
  didNavigateFitzpatrickScale(event) {
    if (event.type !== "keyup") {
      return;
    }

    const scaleNodes =
      event.target
        .closest(".chat-emoji-picker__fitzpatrick-scale")
        ?.querySelectorAll(".chat-emoji-picker__fitzpatrick-modifier-btn") ||
      [];

    const scales = [...scaleNodes];

    if (event.key === "ArrowRight") {
      event.preventDefault();

      if (event.target === scales[scales.length - 1]) {
        scales[0].focus();
      } else {
        event.target.nextElementSibling?.focus();
      }
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();

      if (event.target === scales[0]) {
        scales[scales.length - 1].focus();
      } else {
        event.target.previousElementSibling?.focus();
      }
    }
  }

  @action
  didToggleFitzpatrickScale(event) {
    if (event.type === "keyup") {
      if (event.key === "Escape") {
        event.preventDefault();
        this.isExpandedFitzpatrickScale = false;
        return;
      }

      if (event.key !== "Enter") {
        return;
      }
    }

    this.toggleProperty("isExpandedFitzpatrickScale");
  }

  @action
  didRequestFitzpatrickScale(scale, event) {
    if (event.type === "keyup") {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.isExpandedFitzpatrickScale = false;
        this._focusCurrentFitzpatrickScale();
        return;
      }

      if (event.key !== "Enter") {
        return;
      }
    }

    event.preventDefault();
    event.stopPropagation();

    this.isExpandedFitzpatrickScale = false;
    this.chatEmojiReactionStore.diversity = scale;
    this._focusCurrentFitzpatrickScale();
  }

  _focusCurrentFitzpatrickScale() {
    schedule("afterRender", () => {
      document
        .querySelector(".chat-emoji-picker__fitzpatrick-modifier-btn.current")
        ?.focus();
    });
  }

  @action
  didInputFilter(event) {
    if (!event.target.value.length) {
      this.filteredEmojis = null;
      return;
    }

    discourseDebounce(
      this,
      this.debouncedDidInputFilter,
      event.target.value,
      INPUT_DELAY
    );
  }

  @action
  focusFilter(target) {
    target.focus()
  }

  debouncedDidInputFilter(filter) {
    this.filteredEmojis = this.flatEmojis.filter(
      (emoji) =>
        emoji.name.includes(filter) ||
        emoji.search_aliases?.any((alias) => alias.includes(filter))
    );

    schedule("afterRender", () => {
      const scrollableContent = document.querySelector(
        ".chat-emoji-picker__scrollable-content"
      );

      if (scrollableContent) {
        scrollableContent.scrollTop = 0;
      }
    });
  }

  @action
  didNavigateSection(event) {
    if (event.type !== "keyup") {
      return;
    }

    const sectionEmojis = [
      ...event.target
        .closest(".chat-emoji-picker__section")
        .querySelectorAll(".emoji"),
    ];

    if (event.key === "ArrowRight") {
      event.preventDefault();

      if (event.target === sectionEmojis[sectionEmojis.length - 1]) {
        sectionEmojis[0].focus();
      } else {
        event.target.nextElementSibling?.focus();
      }
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();

      if (event.target === sectionEmojis[0]) {
        sectionEmojis[sectionEmojis.length - 1].focus();
      } else {
        event.target.previousElementSibling?.focus();
      }
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      sectionEmojis
        .filter((c) => c.offsetTop > event.target.offsetTop)
        .find((c) => c.offsetLeft === event.target.offsetLeft)
        ?.focus();
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      sectionEmojis
        .reverse()
        .filter((c) => c.offsetTop < event.target.offsetTop)
        .find((c) => c.offsetLeft === event.target.offsetLeft)
        ?.focus();
    }
  }

  @action
  didSelectEmoji(event) {
    if (!event.target.classList.contains("emoji")) {
      return;
    }

    if (
      event.type === "click" ||
      (event.type === "keyup" && event.key === "Enter")
    ) {
      event.preventDefault();
      event.stopPropagation();
      const originalTarget = event.target;
      let emoji = event.target.dataset.emoji;
      const tonable = event.target.dataset.tonable;
      if (tonable) {
        emoji = `${emoji}:t${this.chatEmojiReactionStore.diversity}`;
      }

      this.chatEmojiPickerManager.didSelectEmoji(emoji);

      schedule("afterRender", () => {
        originalTarget.focus();
      });
    }
  }

  @action
  didFocusFirstEmoji(event) {
    event.preventDefault();
    const section = event.target.closest(".chat-emoji-picker__section").dataset
      .section;
    this.didRequestSection(section);
  }

  @action
  didRequestSection(section) {
    const scrollableContent = document.querySelector(
      ".chat-emoji-picker__scrollable-content"
    );

    this.filteredEmojis = null;

    // we disable scroll listener during requesting section
    // to avoid it from detecting another section during scroll to requested section
    this.emojiPickerScrollObserver.enabled = false;
    this.chatEmojiPickerManager.addVisibleSections([section]);
    this.chatEmojiPickerManager.lastVisibleSection = section;

    // iOS hack to avoid blank div when requesting section during momentum
    if (scrollableContent && this.capabilities.isIOS) {
      document.querySelector(
        ".chat-emoji-picker__scrollable-content"
      ).style.overflow = "hidden";
    }

    schedule("afterRender", () => {
      document
        .querySelector(`.chat-emoji-picker__section[data-section="${section}"]`)
        .scrollIntoView({
          behavior: "auto",
          block: "start",
          inline: "nearest",
        });

      later(() => {
        // iOS hack to avoid blank div when requesting section during momentum
        if (scrollableContent && this.capabilities.isIOS) {
          document.querySelector(
            ".chat-emoji-picker__scrollable-content"
          ).style.overflow = "scroll";
        }

        this.emojiPickerScrollObserver.enabled = true;
      }, 200);
    });
  }

  @action
  addClickOutsideEventListener() {
    document.addEventListener("click", this.didClickOutside);
  }

  @action
  removeClickOutsideEventListener() {
    document.removeEventListener("click", this.didClickOutside);
  }

  @bind
  didClickOutside(event) {
    if (!event.target.closest(".chat-emoji-picker")) {
      this.chatEmojiPickerManager.close();
    }
  }
}
