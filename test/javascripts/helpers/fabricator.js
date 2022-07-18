// heavily inspired from https://github.com/travelperk/fabricator

import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import EmberObject from "@ember/object";

function Fabricator(attributes = {}) {
  const fabricate = (opts) => Fabricate(attributes, opts);
  fabricate.extend = (opts = {}) => Fabricator({ ...attributes, ...opts });
  return fabricate;
}

function Fabricate(attributes, opts = {}) {
  if (typeof attributes === "function") {
    return attributes.apply();
  }

  const extendedModel = { ...attributes, ...opts };

  const object = Object.keys(extendedModel).reduce((o, key) => {
    const value = extendedModel[key];
    o[key] = typeof value === "function" ? value.apply() : value;
    return o;
  }, {});

  // TODO: improve with more models and maybe automatic model creation
  let emberModel;
  if (object.__model === "ChatChannel") {
    emberModel = ChatChannel.create(object);
  } else {
    emberModel = EmberObject.create(object);
  }

  return emberModel;
}

export { Fabricator };
