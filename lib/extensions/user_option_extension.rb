# frozen_string_literal: true

module DiscourseChat::UserOptionExtension
  def self.prepended(base)
    def base.chat_email_frequencies
      @chat_email_frequencies ||= {
        never: 0,
        when_away: 1
      }
    end

    base.enum chat_email_frequency: base.chat_email_frequencies
  end
end
