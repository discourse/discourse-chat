##
# Processes slack-formatted text messages, as Mattermost does with
# Slack incoming webhook interopability, for example links in the
# format <LINK> and <LINK|TEXT>, <!here> and <!all> mentions.
#
# See https://api.slack.com/reference/surfaces/formatting for all of
# the different formatting slack supports with mrkdwn which is mostly
# identical to Markdown.
#
# Mattermost docs for translating the slack format:
#
# https://docs.mattermost.com/developer/webhooks-incoming.html?highlight=translate%20slack%20data%20format%20mattermost#translate-slack-s-data-format-to-mattermost
#
# We may want to process attachments and blocks from slack in future, and
# convert user IDs into user mentions.
class DiscourseChat::SlackCompatibility
  MRKDWN_LINK_REGEX = Regexp.new(/(<[^\n<\|>]+>|<[^\n<\>]+>)/).freeze

  class << self
    def process_text(text)
      text = text.gsub("<!here>", "@here")
      text = text.gsub("<!all>", "@all")

      text.scan(MRKDWN_LINK_REGEX) do |match|
        match = match.first

        if match.include?("|")
          link, title = match.split("|")[0..1]
        else
          link = match
        end

        title = title&.gsub(/<|>/, "")
        link = link&.gsub(/<|>/, "")

        if title
          text = text.gsub(match, "[#{title}](#{link})")
        else
          text = text.gsub(match, "#{link}")
        end
      end

      return text
    end
  end
end
