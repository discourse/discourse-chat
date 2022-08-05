{{#if channel}}
  <div
    class={{concat
      "chat-channel-card"
      (if channel.isClosed " -closed")
      (if channel.isArchived " -archived")
    }}
    style={{border-color channel.chatable.color}}
  >
    {{#link-to
      "chat.channel.info.settings"
      channel.id
      (slugify-channel channel.title)
      class="chat-channel-card__setting"
      tabindex="-1"
    }}
      {{d-icon "cog"}}
    {{/link-to}}

    {{#link-to
      "chat.channel"
      channel.id
      (slugify-channel channel.title)
      class="chat-channel-card__name-container"
    }}
      <span class="chat-channel-card__name">
        {{replace-emoji channel.title}}
      </span>
      {{#if channel.chatable.read_restricted}}
        {{d-icon "lock" class="chat-channel-card__read-restricted"}}
      {{/if}}
    {{/link-to}}

    {{#if channel.description}}
      <div class="chat-channel-card__description">
        {{replace-emoji channel.description}}
      </div>
    {{/if}}

    <div class="chat-channel-card__cta">
      {{#if channel.isFollowing}}
        <div class="chat-channel-card__tags">
          <span class="chat-channel-card__tag -joined">
            {{i18n "chat.joined"}}
          </span>

          {{#if channel.current_user_membership.muted}}
            {{#link-to
              "chat.channel.info.settings"
              channel.id
              (slugify-channel channel.title)
              class="chat-channel-card__tag -muted"
              tabindex="-1"
            }}
              {{i18n "chat.muted"}}
            {{/link-to}}
          {{/if}}
        </div>
      {{else if channel.isJoinable}}
        <ToggleChannelMembershipButton
          @channel={{this.channel}}
          @onToggle={{action "afterMembershipToggle"}}
          @options={{hash joinClass="btn-primary btn-small chat-channel-card__join-btn" labelType="short"}}
        />
      {{/if}}

      {{#if (gt channel.membershipsCount 0)}}
        {{#link-to
          "chat.channel.info.members"
          channel.id
          (slugify-channel channel.title)
          class="chat-channel-card__members"
          tabindex="-1"
        }}
          {{i18n
            "chat.channel.memberships_count"
            count=channel.membershipsCount
          }}
        {{/link-to}}
      {{/if}}
    </div>
  </div>
{{/if}}
