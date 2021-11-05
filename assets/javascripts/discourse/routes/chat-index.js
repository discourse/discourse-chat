import DiscourseRoute from "discourse/routes/discourse";
import { ajax } from "discourse/lib/ajax";

export default DiscourseRoute.extend({
  model() {
    return ajax("/chat/chat_channels/all.json");
  },
});
