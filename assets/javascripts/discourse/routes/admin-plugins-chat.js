import DiscourseRoute from "discourse/routes/discourse";
import { ajax } from "discourse/lib/ajax";

export default DiscourseRoute.extend({
  model() {
    if (!this.currentUser?.admin) {
      return { model: null };
    }

    return ajax("/admin/plugins/chat.json");
  }
})
