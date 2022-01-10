import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
export default Component.extend({
  name: null,
  icon: null,
  tagName: "",

  @discourseComputed("name", "currentPane")
  wrapperClassNames(paneName, currentPaneName) {
    const classes = ["chat-pane-option"];
    if (paneName === currentPaneName) {
      classes.push("active");
    }
    return classes.join(" ");
  },
});
