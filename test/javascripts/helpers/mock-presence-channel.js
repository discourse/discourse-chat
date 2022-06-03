import EmberObject from "@ember/object";

export default EmberObject.extend({
  init() {
    this._super(...arguments);

    this.set("users", []);
  },

  users: null,
  name: null,
  subscribed: false,

  async unsubscribe() {
    this.set("subscribed", false);
  },

  async subscribe() {
    this.set("subscribed", true);
  },
});
