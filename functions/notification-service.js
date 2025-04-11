/**
 * Notification Service
 * Handles notifications for complex support issues
 */

const axios = require('axios');

/**
 * Configuration for notification channels
 * Set these from environment variables in production
 */
const DEFAULT_CONFIG = {
  email: {
    enabled: false,
    recipientEmail: 'support@example.com',
    fromEmail: 'noreply@example.com',
    subject: 'Complex Customer Support Issue Detected'
  },
  slack: {
    enabled: false,
    webhookUrl: process.env.SLACK_WEBHOOK_URL
  },
  logging: {
    enabled: true,
    level: 'info' // debug, info, warn, error
  }
};

/**
 * Notification service for complex customer support issues
 */
class NotificationService {
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };

    // Service state
    this.isInitialized = true;
    this.notificationCount = 0;
  }

  /**
   * Send notification for a complex issue
   * 
   * @param {Object} issueData - Information about the complex issue
   * @returns {Promise<Object>} Notification result
   */
  async notifyComplexIssue(issueData) {
    const result = {
      success: false,
      channels: [],
      error: null
    };

    try {
      // Validate required data
      if (!issueData || !issueData.message) {
        throw new Error('Invalid issue data: message is required');
      }

      const channelResults = [];
      
      // Send email notification
      if (this.config.email && this.config.email.enabled) {
        try {
          const emailResult = await this.sendEmailNotification(issueData);
          channelResults.push({ channel: 'email', success: true, result: emailResult });
        } catch (error) {
          channelResults.push({ channel: 'email', success: false, error: error.message });
        }
      }

      // Send Slack notification
      if (this.config.slack && this.config.slack.enabled) {
        try {
          const slackResult = await this.sendSlackNotification(issueData);
          channelResults.push({ channel: 'slack', success: true, result: slackResult });
        } catch (error) {
          channelResults.push({ channel: 'slack', success: false, error: error.message });
        }
      }

      // Always log the issue
      if (this.config.logging && this.config.logging.enabled) {
        this.logComplexIssue(issueData);
        channelResults.push({ channel: 'logging', success: true });
      }

      // Update counters
      this.notificationCount++;

      // Prepare result
      result.success = channelResults.some(r => r.success);
      result.channels = channelResults;
      
      return result;
    } catch (error) {
      console.error('Failed to send notification:', error);
      result.error = error.message;
      return result;
    }
  }

  /**
   * Send email notification using SendGrid or similar service
   * 
   * @param {Object} issueData - Information about the complex issue
   * @returns {Promise<Object>} Email result
   */
  async sendEmailNotification(issueData) {
    // This is a placeholder - in production, use your preferred email service
    // Example using SendGrid:
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY environment variable not set');
    }

    const { message, email = 'unknown', response = '', reasons = [] } = issueData;
    
    const emailContent = `
A complex customer support issue was detected that may require human assistance.

Query: ${message}
From: ${email}
Detected Issues: ${reasons.join(', ')}

System Response: 
${response}

Please review and provide personalized assistance if needed.
`;

    try {
      /*
      // Uncomment this code when ready to implement with SendGrid
      await axios.post('https://api.sendgrid.com/v3/mail/send', {
        personalizations: [{
          to: [{ email: this.config.email.recipientEmail }]
        }],
        from: { email: this.config.email.fromEmail },
        subject: this.config.email.subject,
        content: [{
          type: 'text/plain',
          value: emailContent
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      */
      
      // For now, just simulate a successful send
      console.log('[EMAIL NOTIFICATION] Would send email for complex issue');
      return { success: true, simulated: true };
    } catch (error) {
      console.error('Failed to send email notification:', error.message);
      throw error;
    }
  }

  /**
   * Send Slack notification
   * 
   * @param {Object} issueData - Information about the complex issue
   * @returns {Promise<Object>} Slack result
   */
  async sendSlackNotification(issueData) {
    if (!this.config.slack.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const { message, email = 'unknown', response = '', reasons = [] } = issueData;
    
    try {
      /*
      // Uncomment when ready to implement with Slack
      await axios.post(this.config.slack.webhookUrl, {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "Complex Support Issue Detected",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*From:*\n${email}`
              },
              {
                type: "mrkdwn",
                text: `*Detected Issues:*\n${reasons.join(', ')}`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Query:*\n${message}`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*System Response:*\n${response.substring(0, 300)}${response.length > 300 ? '...' : ''}`
            }
          }
        ]
      });
      */
      
      // For now, just simulate a successful send
      console.log('[SLACK NOTIFICATION] Would send Slack message for complex issue');
      return { success: true, simulated: true };
    } catch (error) {
      console.error('Failed to send Slack notification:', error.message);
      throw error;
    }
  }

  /**
   * Log complex issue to console or logging service
   * 
   * @param {Object} issueData - Information about the complex issue
   */
  logComplexIssue(issueData) {
    const { message, email = 'unknown', response = '', reasons = [] } = issueData;
    console.log('\n=== COMPLEX ISSUE DETECTED ===');
    console.log(`From: ${email}`);
    console.log(`Query: ${message}`);
    console.log(`Issues: ${reasons.join(', ')}`);
    console.log('=== END COMPLEX ISSUE ===\n');
  }
}

module.exports = NotificationService;
