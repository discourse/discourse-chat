import { A } from "@ember/array";
import { ajax } from "discourse/lib/ajax";
import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";

const MAX_RECENT_MSGS = 100;

function makeLookupMap(usersData) {
  const ret = {};
  usersData.forEach(v => {
    ret[v.id] = v;
  });
  return ret;
}

export default Component.extend({
  topicId: null,
  registeredTopicId: null,

  messages: A(),

  didReceiveAttrs() {
    this._super(...arguments);

    if (this.registeredTopicId != this.topicId) {
      if (this.registeredTopicId) {
        this.messageBus.unsubscribe(`/chat/${this.registeredTopicId}`);
        this.messages.clear();
      }
      
      //if (this.topicId != null) {
      if (this.topicId == 75) {
        //ajax(`/chat/t/${this.topicId}/recent`).then(data => {
        ajax(`/about.json`).then(data => {
          data = {};
          data.messages = [
            {
              id: 8001,
              topic_id: 75,
              user_id: 4,
              post_id: 825,
              created_at: new Date(),
              deleted_at: null,
              message: "Hello World first chat",
            },
            {
              id: 8002,
              topic_id: 75,
              user_id: 1,
              post_id: 825,
              created_at: new Date(),
              deleted_at: null,
              message: "hey there!",
              in_reply_to_id: 8001,
              in_reply_to_user_id: 4,
            },
          ];
          data.users = [
            {"id":1,"username":"kanepyork","name":null,"avatar_template":"/user_avatar/localhost/kanepyork/{size}/1_2.png"},{"id":4,"username":"rikignreelw","name":"jskdflj","avatar_template":"/letter_avatar_proxy/v4/letter/r/a587f6/{size}.png"}
          ];

          const usersLookup = makeLookupMap(data.users);
          this.set('messages', A(data.messages.map(m => this.prepareMessage(m, usersLookup))));

          this.messageBus.subscribe(`/chat/${this.registeredTopicId}`, (busData) => {
            this.handleMessage(busData);
          }, data.last_id);
        });
      }
    }
  },

  prepareMessage(msgData, userLookup) {
    msgData.user = userLookup[msgData.user_id];
    return msgData;
  },

  handleMessage(data) {
    // TODO

  },


});
