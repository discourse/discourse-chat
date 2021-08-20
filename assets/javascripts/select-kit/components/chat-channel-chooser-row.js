import SelectKitRowComponent from "select-kit/components/select-kit/select-kit-row";
// import layout from "select-kit/templates/components/chat-channel-chooser-row";
// import layout from "discourse/plugins/discourse-topic-chat/discourse/templates/components/select-kit-chat-channel-row";

export default SelectKitRowComponent.extend({
  layoutName: "select-kit/templates/components/chat-channel-chooser-row",
  classNames: ["chat-channel-chooser-row"],
});
