import Controller from "@ember/controller";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";

export default Controller.extend({
  queryParams: ["messageId"],
  chat: service(),
});
