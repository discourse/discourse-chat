import fabricate from "../helpers/fabricators";
import { isPresent } from "@ember/utils";
import Service from "@ember/service";

let publicChannels;
let userCanChat;
let isBrowsePage;
let isChatPage;

class ChatStub extends Service {
  userCanChat = userCanChat;
  publicChannels = publicChannels;
  isBrowsePage = isBrowsePage;
  isChatPage = isChatPage;
}

export function setup(context, options = {}) {
  context.registry.register("service:chat-stub", ChatStub);
  context.registry.injection("component", "chat", "service:chat-stub");

  publicChannels = isPresent(options.publicChannels)
    ? options.publicChannels
    : [fabricate("chat-channel")];
  userCanChat = isPresent(options.userCanChat) ? options.userCanChat : true;
  isBrowsePage = isPresent(options.isBrowsePage) ? options.isBrowsePage : false;
  isChatPage = isPresent(options.isChatPage) ? options.isChatPage : false;
}

export function teardown() {
  publicChannels = [];
  userCanChat = true;
  isBrowsePage = false;
  isChatPage = false;
}
