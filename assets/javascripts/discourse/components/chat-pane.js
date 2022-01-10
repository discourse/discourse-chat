import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
export default Component.extend({
  paneName: null,
  icon: null,
  tagName: "",

  @discourseComputed("paneName", "currentPane")
  wrapperClassNames(paneName, currentPaneName) {
    const classes = ["chat-pane"];
    if (paneName !== currentPaneName) {
      classes.push("inactive");
    }
    return classes.join(" ");
  },
});
