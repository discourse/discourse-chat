const MARKDOWN_OVERRIDES = {
  featuresOverride: [
    "anchor",
    "bbcode-block",
    "bbcode-inline",
    "category-hashtag",
    "censored",
    "discourse-local-dates",
    "emoji",
    // "emojiShortcuts",
    "inlineEmoji",
    "html-img",
    "mentions",
    "onebox",
    "text-post-process",
    "upload-protocol",
    "watched-words",
    "table",
    // "spoiler-alert",
    "discourse-chat-transcript",
  ],
  markdownItRules: [
    "autolink",
    "list",
    "backticks",
    "newline",
    "code",
    "fence",
    "table",
    "linkify",
    "link",
    "strikethrough",
    "blockquote",
    "emphasis",
  ],
};
let customMarkdownCookFn;

const chatTranscriptRule = {
  tag: "chat",

  before: function (state) {
    let wrapperDivToken = state.push("div_chat_transcript_wrap", "div", 1);
    wrapperDivToken.attrs = [["class", "discourse-chat-transcript"]];
  },

  replace: function (state, tagInfo, content) {
    let wrapperDivToken = state.push("div_chat_transcript_wrap", "div", 1);
    wrapperDivToken.attrs = [["class", "discourse-chat-transcript"]];
    const token = state.push("html_raw", "", 0);
    token.content = customMarkdownCookFn(content);
    state.push("html_raw", "", -1);
    state.push("div_chat_transcript_wrap", "div", -1);
    return true;
  },

  after: function (state) {
    state.push("div_chat_transcript_wrap", "div", -1);
  },
};

export function setup(helper) {
  helper.allowList([
    "div.discourse-chat-transcript",
    "div[data-chat-channel-id]",
    "div[data-chat-message-id-range-start]",
    "div[data-chat-message-id-range-end]",
  ]);

  helper.registerOptions((opts, siteSettings) => {
    opts.features["discourse-chat-transcript"] = !!siteSettings.chat_enabled;
  });

  helper.registerPlugin((md) => {
    if (md.options.discourse.features["discourse-chat-transcript"]) {
      md.block.bbcode.ruler.push(
        "discourse-chat-transcript",
        chatTranscriptRule
      );
    }
  });

  helper.buildCustomMarkdownEngine((build) => {
    build(MARKDOWN_OVERRIDES, (customMarkdownEngineRenderFn) => {
      customMarkdownCookFn = customMarkdownEngineRenderFn;
    });
  });
}
