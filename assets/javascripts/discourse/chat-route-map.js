export default function () {
  this.route("chat", { path: "/chat" }, function () {
    this.route(
      "channel",
      { path: "/channel/:channelId/:channelTitle" },
      function () {
        this.route("info", { path: "/info" }, function () {
          this.route("about", { path: "/about" });
          this.route("members", { path: "/members" });
          this.route("settings", { path: "/settings" });
        });
      }
    );

    this.route("draft-channel", { path: "/draft-channel" });
    this.route("browse", { path: "/browse" });
    this.route("message", { path: "/message/:messageId" });
    this.route("channelByName", { path: "/chat_channels/:channelName" });
  });
}
