import getURL from "discourse-common/lib/get-url";
import { escapeExpression } from "discourse/lib/utilities";
import { emojiUnescape } from "discourse/lib/text";
const mentionsModule = require("pretty-text/engines/discourse-markdown/mentions");

export default function cook(raw, siteSettings, categories) {
  if (!raw) {
    return;
  }

  let cooked = escapeExpression(raw);
  cooked = transformMentions(cooked, siteSettings.unicode_usernames);
  cooked = transformCategoryTagHashes(cooked, categories);
  cooked = convertNewlines(cooked);
  cooked = convertLinks(cooked);

  return emojiUnescape(cooked);
}

function transformMentions(raw, unicode_usernames) {
  const mentionRegex = new RegExp(
    mentionsModule.mentionRegex(unicode_usernames),
    "g"
  );
  return raw.replace(mentionRegex, function (a, b) {
    const href = getURL(`/u/${b}`);
    return `<a class="mention" href="${href}">${a}</a>`;
  });
}

function transformCategoryTagHashes(raw, categories) {
  return raw.replace(
    /(\s|^)#([\u00C0-\u1FFF\u2C00-\uD7FF\w:-]{1,101})/g,
    function (a, _, b) {
      const matchingCategory = categories.find(
        (category) => category.name.toLowerCase() === b.toLowerCase()
      );
      const href = getURL(
        matchingCategory
          ? `/c/${matchingCategory.name}/${matchingCategory.id}`
          : `/tag/${b}`
      );
      return `<a class="hashtag" href=${href}>${a}</a>`;
    }
  );
}

function convertNewlines(raw) {
  return raw.replace(/\n/g, "<br>");
}

// Regex's are from stack overflow
// https://stackoverflow.com/questions/49634850/javascript-convert-plain-text-links-to-clickable-links
const LINK_HTTP_REGEX = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
const LINK_WWW_REGEX = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
const LINK_MAILTO_REGEX = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;

function convertLinks(raw) {
  let cooked = raw.replace(
    LINK_HTTP_REGEX,
    '<a href="$1" target="_blank">$1</a>'
  );
  cooked = cooked.replace(
    LINK_WWW_REGEX,
    '$1<a href="http://$2" target="_blank">$2</a>'
  );
  return cooked.replace(LINK_MAILTO_REGEX, '<a href="mailto:$1">$1</a>');
}
