import EmberObject from "@ember/object";

export default EmberObject.extend({
  init() {
    this._super(...arguments);

    this.set("users", []);
  },

  users: null,

  unsubscribe() {},

  name: null,
});
