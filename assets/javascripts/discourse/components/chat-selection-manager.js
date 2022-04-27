import Component from "@ember/component";
import { action, computed } from "@ember/object";
import { alias } from "@ember/object/computed";
import showModal from "discourse/lib/show-modal";
import { clipboardCopyAsync } from "discourse/lib/utilities";
import { getOwner } from "discourse-common/lib/get-owner";
import { ajax } from "discourse/lib/ajax";
import { isTesting } from "discourse-common/config/environment";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import getURL from "discourse-common/lib/get-url";

export default class AdminCustomizeColorsShowController extends Component {
  tagName = "";
  chatChannel = null;
  selectedMessageIds = null;
  showChatQuoteSuccess = false;
  cancelSelecting = null;

  @service router;
  @alias("currentUser.staff") showMoveMessages;

  @computed("selectedMessageIds.length")
  get anyMessagesSelected() {
    return this.selectedMessageIds.length > 0;
  }

  @action
  moveMessagesToChannel() {
    showModal("chat-message-move-to-channel-modal").setProperties({
      sourceChannel: this.chatChannel,
      selectedMessageIds: this.selectedMessageIds,
    });
  }

  @action
  async quoteMessages() {
    const quoteGenerationPromise = async () => {
      const response = await ajax(
        getURL(`/chat/${this.chatChannel.id}/quote.json`),
        {
          data: { message_ids: this.selectedMessageIds },
          type: "POST",
        }
      );
      return new Blob([response.markdown], {
        type: "text/plain",
      });
    };

    if (!this.site.isMobileDevice && this.currentUser.chat_isolated) {
      return this._copyQuoteToClipboard(quoteGenerationPromise);
    }

    return this._copyQuoteToComposer(quoteGenerationPromise);
  }

  _showCopyQuoteSuccess() {
    this.set("showChatQuoteSuccess", true);

    schedule("afterRender", () => {
      if (!this.element || this.isDestroying || this.isDestroyed) {
        return;
      }

      const element = document.querySelector(".chat-selection-message");
      element.addEventListener(
        "animationend",
        () => {
          this.set("showChatQuoteSuccess", false);
        },
        { once: true }
      );
    });
  }

  _goToChatableUrl() {
    if (this.chatChannel.chatable_url) {
      return this.router.transitionTo(this.chatChannel.chatable_url);
    }
  }

  _copyQuoteToClipboard(quoteGenerationPromise) {
    if (!isTesting()) {
      return clipboardCopyAsync(quoteGenerationPromise)
        .then(() => {
          this._showCopyQuoteSuccess();
        })
        .catch(popupAjaxError);
    } else {
      // clipboard API throws errors in tests
      return;
    }
  }

  async _copyQuoteToComposer(quoteGenerationPromise) {
    let quoteMarkdownBlob, quoteMarkdown;
    try {
      quoteMarkdownBlob = await quoteGenerationPromise();
      quoteMarkdown = await quoteMarkdownBlob.text();
    } catch (error) {
      popupAjaxError(error);
    }
    const container = getOwner(this);
    const composer = container.lookup("controller:composer");
    const openOpts = {};

    if (this.chatChannel.isCategoryChannel) {
      openOpts.categoryId = this.chatChannel.chatable_id;
    }

    if (this.site.isMobileDevice) {
      // go to the relevant chatable (e.g. category) and open the
      // composer to insert text
      this._goToChatableUrl().then(() => {
        composer.focusComposer({
          fallbackToNewTopic: true,
          insertText: quoteMarkdown,
          openOpts,
        });
      });
    } else {
      // open the composer and insert text, reply to the current
      // topic if there is one, use the active draft if there is one
      const topic = container.lookup("controller:topic");
      composer.focusComposer({
        fallbackToNewTopic: true,
        topic: topic?.model,
        insertText: quoteMarkdown,
        openOpts,
      });
    }
  }
}
