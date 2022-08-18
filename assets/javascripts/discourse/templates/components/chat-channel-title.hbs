{{#if channel.isDraft}}
  <div class="chat-channel-title is-draft">
    <span class="chat-channel-title__name">{{channel.title}}</span>
    {{#if (has-block)}}
      {{yield}}
    {{/if}}
  </div>
{{else}}
  {{#if channel.isDirectMessageChannel}}
    <div class="chat-channel-title is-dm">
      {{#if multiDm}}
        <span class="chat-channel-title__users-count">
          {{channel.chatable.users.length}}
        </span>
        <span class="chat-channel-title__name">{{usernames}}</span>
      {{else}}
        {{chat-user-avatar user=channel.chatable.users.firstObject}}
        <span class="chat-channel-title__usernames">
          {{#let channel.chatable.users.firstObject as |user|}}
            <span class="chat-channel-title__name">{{user.username}}</span>
            {{plugin-outlet
              name="after-chat-channel-username"
              args=(hash user=user)
              tagName=""
              connectorTagName=""
            }}
          {{/let}}
        </span>
      {{/if}}

      {{#if (has-block)}}
        {{yield}}
      {{/if}}
    </div>
  {{else if channel.isCategoryChannel}}
    <div class="chat-channel-title is-category">
      <span
        class="chat-channel-title__category-badge"
        style={{this.channelColorStyle}}
      >
        {{d-icon "hashtag"}}
        {{#if channel.chatable.read_restricted}}
          {{d-icon "lock" class="chat-channel-title__restricted-category-icon"}}
        {{/if}}
      </span>
      <span class="chat-channel-title__name">
        {{replace-emoji channel.title}}
      </span>

      {{#if (has-block)}}
        {{yield}}
      {{/if}}
    </div>
  {{/if}}

  {{#if unreadIndicator}}
    {{chat-channel-unread-indicator channel=channel}}
  {{/if}}
{{/if}}
