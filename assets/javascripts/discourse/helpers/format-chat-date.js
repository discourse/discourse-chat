import { registerUnbound } from "discourse-common/lib/helpers";
import { htmlSafe } from "@ember/template";
import getURL from "discourse-common/lib/get-url";

registerUnbound("format-chat-date", function (message, details, mode) {
  let date = new Date(message.created_at);
  let hours = date.getHours();
  let amPm = "";

  if (mode !== "tiny") {
    amPm = hours > 11 ? " PM" : " AM";
  }

  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }

  let minutes = date.getMinutes().toString().padStart(2, "0");
  let url = "";

  if (details) {
    url = `chat/${details.chat_channel_id}/`;
    url = getURL(
      `/chat/channel/${details.chat_channel_id}/chat?messageId=${message.id}`
    );
  }

  // not super happy to be calling moment here, maybe we should move to an attribute
  let title = moment(date).format(I18n.t("dates.long_with_year"));

  return htmlSafe(
    `<a title='${title}' class='tc-time' href='${url}'>${hours}:${minutes} ${amPm}</a>`
  );
});
