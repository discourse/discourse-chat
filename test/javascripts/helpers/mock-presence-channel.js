import EmberObject from "@ember/object";

export default EmberObject.extend({
  init() {
    this._super(...arguments);

    this.set("users", []);
  },

  users: null,

  async unsubscribe() {},

  async subscribe() {},

  name: null,
});
