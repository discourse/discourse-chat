import { registerUnbound } from "discourse-common/lib/helpers";

registerUnbound("tonable-emoji-title", function (emoji, scale) {
  if (!emoji.tonable || scale === 1) {
    return `:${emoji.name}:`;
  }

  return `:${emoji.name}:t${scale}:`;
});
