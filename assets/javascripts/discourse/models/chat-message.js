import RestModel from "discourse/models/rest";
import User from "discourse/models/user";

const ChatMessage = RestModel.extend({});

ChatMessage.reopenClass({
  create(args) {
    args = args || {};
    this._initUserModel(args);
    return this._super(args);
  },

  _initUserModel(args) {
    if (args.user) {
      args.user = User.create(args.user);
    }
  },
});

export default ChatMessage;
