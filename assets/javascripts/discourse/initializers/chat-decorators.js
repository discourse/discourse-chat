import { decorateGithubOneboxBody } from "discourse/initializers/onebox-decorators";
import { resolveAllShortUrls } from "pretty-text/upload-short-url";
import { ajax } from "discourse/lib/ajax";
import { withPluginApi } from "discourse/lib/plugin-api";
import highlightSyntax from "discourse/lib/highlight-syntax";
import I18n from "I18n";
import DiscourseURL from "discourse/lib/url";
import { samePrefix } from "discourse-common/lib/get-url";
import loadScript from "discourse/lib/load-script";
import { spinnerHTML } from "discourse/helpers/loading-spinner";

export default {
  name: "chat-decorators",

  initializeWithPluginApi(api, container) {
    api.decorateChatMessage((element) => decorateGithubOneboxBody(element), {
      id: "onebox-github-body",
    });

    api.decorateChatMessage(
      (element) => {
        element
          .querySelectorAll(".onebox.githubblob li.selected")
          .forEach((line) => {
            const scrollingElement = this._getScrollParent(line, "onebox");

            // most likely a very small file which doesn’t need scrolling
            if (!scrollingElement) {
              return;
            }

            const scrollBarWidth =
              scrollingElement.offsetHeight - scrollingElement.clientHeight;

            scrollingElement.scroll({
              top:
                line.offsetTop +
                scrollBarWidth -
                scrollingElement.offsetHeight / 2 +
                line.offsetHeight / 2,
            });
          });
      },
      {
        id: "onebox-github-scrolling",
      }
    );

    const siteSettings = container.lookup("site-settings:main");
    api.decorateChatMessage(
      (element) =>
        highlightSyntax(
          element,
          siteSettings,
          container.lookup("session:main")
        ),
      { id: "highlightSyntax" }
    );

    api.decorateChatMessage(this.renderChatTranscriptDates, {
      id: "transcriptDates",
    });

    api.decorateChatMessage(this.forceLinksToOpenNewTab, {
      id: "linksNewTab",
    });

    api.decorateChatMessage(
      (element) => resolveAllShortUrls(ajax, siteSettings, element),
      {
        id: "resolveShortUrls",
      }
    );

    api.decorateChatMessage(
      (element) =>
        this.lightbox(element.querySelectorAll("img:not(.emoji, .avatar)")),
      {
        id: "lightbox",
      }
    );
  },

  _getScrollParent(node, maxParentSelector) {
    if (node === null || node.classList.contains(maxParentSelector)) {
      return null;
    }

    if (node.scrollHeight > node.clientHeight) {
      return node;
    } else {
      return this._getScrollParent(node.parentNode, maxParentSelector);
    }
  },

  renderChatTranscriptDates(element) {
    element
      .querySelectorAll(".discourse-chat-transcript")
      .forEach((transcriptEl) => {
        const dateTimeRaw = transcriptEl.dataset["datetime"];
        const dateTimeLinkEl = transcriptEl.querySelector(
          ".chat-transcript-datetime a"
        );

        // same as highlight, no need to do this for every single message every time
        // any message changes
        if (dateTimeLinkEl.innerText !== "") {
          return;
        }

        if (this.currentUserTimezone) {
          dateTimeLinkEl.innerText = moment
            .tz(dateTimeRaw, this.currentUserTimezone)
            .format(I18n.t("dates.long_no_year"));
        } else {
          dateTimeLinkEl.innerText = moment(dateTimeRaw).format(
            I18n.t("dates.long_no_year")
          );
        }
      });
  },

  forceLinksToOpenNewTab(element) {
    const links = element.querySelectorAll(
      ".chat-message-text a:not([target='_blank'])"
    );
    for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
      const link = links[linkIndex];
      if (
        this.currentUser.chat_isolated ||
        !DiscourseURL.isInternal(link.href) ||
        !samePrefix(link.href)
      ) {
        link.setAttribute("target", "_blank");
      }
    }
  },

  lightbox(images) {
    loadScript("/javascripts/jquery.magnific-popup.min.js").then(function () {
      $(images).magnificPopup({
        type: "image",
        closeOnContentClick: false,
        mainClass: "mfp-zoom-in",
        tClose: I18n.t("lightbox.close"),
        tLoading: spinnerHTML,
        image: {
          verticalFit: true,
        },
        callbacks: {
          elementParse: (item) => {
            item.src = item.el[0].src;
          },
        },
      });
    });
  },

  initialize(container) {
    withPluginApi("0.8.42", (api) =>
      this.initializeWithPluginApi(api, container)
    );
  },
};
