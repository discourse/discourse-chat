export default function() {
  this.route("chat", { path: "/chat" }, function() {
    this.route("channel", { path: '/channel/:channelId' })
  })
}
