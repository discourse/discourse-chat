import { escapeExpression } from "discourse/lib/utilities";
import { emojiUnescape } from "discourse/lib/text";
const mentionsModule = require("pretty-text/engines/discourse-markdown/mentions");
const categoryHashtagRegex = require("pretty-text/engines/discourse-markdown/category-hashtag")
  .categoryHashtagRegex;

export default function cook(raw, siteSettings, categories) {
  let cooked = escapeExpression(raw);
  cooked = transformMentions(cooked, siteSettings.unicode_usernames);
  cooked = transformCategoryTagHashes(cooked, categories);

  return emojiUnescape(cooked);
}

function transformMentions(raw, unicode_usernames) {
  const mentionRegex = new RegExp(
    mentionsModule.mentionRegex(unicode_usernames),
    "g"
  );
  return raw.replace(mentionRegex, function (a, b) {
    return `<a class="mention" href="/u/${b}">${a}</a>`;
  });
}

function transformCategoryTagHashes(raw, categories) {
  return raw.replace(
    /(\s|^)#([\u00C0-\u1FFF\u2C00-\uD7FF\w:-]{1,101})/g,
    function (a, _, b) {
      const category = categories.find(
        (category) => category.name.toLowerCase() === b.toLowerCase()
      );
      const href = category
        ? `/c/${category.name}/${category.id}`
        : `/tag/${b}`;
      return `<a class="hashtag" href=${href}>${a}</a>`;
    }
  );
}
