import { parseBBCodeTag } from "pretty-text/engines/discourse-markdown/bbcode-block";
import { cloneJSON } from "discourse-common/lib/object";

let oldFeatureSet = {};
let mdEngine = null;

const chatTranscriptRule = {

  tag: "chat",

  replace: function (state, tagInfo, content) {
    // debugger
    // console.log(md, state, info, content);
        const token = state.push('html_raw', '', 0);
        content = content
          .split("\n")
          .filter(Boolean)
          .map(x => state.md.utils.escapeHtml(x))
          .join("\n");
        token.content = `<div class="discourse-chat-transcript">\n${content}\n</div>\n`;
        return true;
  },

  before: function (state, info) {
    console.log("hitbefore");
    // console.log("chat-transcript", state, info);
    console.log("chat-transcript attrs", info.attrs);
    let wrapperDivToken = state.push("div_chat_transcript_wrap", "div", 1);
    wrapperDivToken.attrs = [["class", "discourse-chat-transcript"]];
  },

  after: function (state) {
    state.push("div_chat_transcript_wrap", "div", -1);
    console.log("hit after");
    // mdEngine.options.discourse.features = oldFeatureSet;
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
    // oldFeatureSet = cloneJSON(md.options.discourse.features);
    // mdEngine = md;
    // md.options.discourse.featuresOverride = [
    //   "anchor",
    //   "bbcode-block",
    //   "bbcode-inline",
    //   "category-hashtag",
    //   "censored",
    //   "discourse-local-dates",
    //   "emoji",
    //   // "emojiShortcuts",
    //   "inlineEmoji",
    //   "html-img",
    //   "mentions",
    //   "onebox",
    //   "text-post-process",
    //   "upload-protocol",
    //   "watched-words",
    //   "table",
    //   "spoiler-alert",
    // ];
    // debugger
    const features = md.options.discourse.features;
    if (features["discourse-chat-transcript"]) {
      // features["emojiShortcuts"] = false;
      console.log(md.block.bbcodedatchatboi.ruler.push);
      md.block.bbcodedatchatboi.ruler.push(
        "discourse-chat-transcript",
        chatTranscriptRule
      );
// md.block.bbcodedatchatboi.ruler.disable(["emojiShortcuts"])
      console.log("bbcode", md.block.bbcode);
      console.log("bbcodechatboi", md.block.bbcodedatchatboi);
    }
  });
}
