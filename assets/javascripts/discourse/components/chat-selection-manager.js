import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { clipboardCopyAsync } from "discourse/lib/utilities";
import { getOwner } from "discourse-common/lib/get-owner";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { isTesting } from "discourse-common/config/environment";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import getURL from "discourse-common/lib/get-url";

export default Component.extend({
  tagName: "",
  router: service(),
  chatChannel: null,
  selectedMessageIds: null,
  showChatQuoteSuccess: false,
  cancelSelecting: null,

  @discourseComputed("selectedMessageIds")
  anyMessagesSelected(selectedMessageIds) {
    return selectedMessageIds.length > 0;
  },

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

    // copy the generated quote to the clipboard
    if (!this.site.isMobileDevice && this.currentUser.chat_isolated) {
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
  },

  _showCopyQuoteSuccess() {
    this.set("showChatQuoteSuccess", true);

    schedule("afterRender", () => {
      if (this._selfDeleted) {
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
  },

  _goToChatableUrl() {
    if (this.chatChannel.chatable_url) {
      return this.router.transitionTo(this.chatChannel.chatable_url);
    }
  },
});
