import Component from "@ember/component";
import { action } from "@ember/object";
import showModal from "discourse/lib/show-modal";

export default class ChatChannelAboutView extends Component {
  tagName = "";
  channel = null;
  onEditChatChannelTitle = null;
  onEditChatChannelDescription = null;
}
