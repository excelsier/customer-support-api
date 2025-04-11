/**
 * Customer profile and conversation history schema
 * Used for storing and managing customer data in the support system
 */

// Customer profile schema
const customerProfileSchema = {
  // Basic customer information
  id: String,            // Unique customer identifier
  email: String,         // Customer email (can be used as identifier)
  name: String,          // Customer name
  company: String,       // Customer's company or organization
  phoneNumber: String,   // Contact phone number
  
  // Metadata
  firstContact: Date,    // When this customer first contacted support
  lastContact: Date,     // Most recent contact
  totalConversations: Number, // Total number of conversation threads
  tags: [String],        // Tags associated with this customer
  
  // Integration IDs
  crmId: String,         // ID in the external CRM system
  externalIds: {         // Additional external system IDs if needed
    // systemName: "id"
  },
  
  // Custom attributes (flexible for different use cases)
  attributes: {
    // key: value
  }
};

// Conversation history schema
const conversationSchema = {
  id: String,            // Unique conversation ID
  customerId: String,    // Reference to customer
  title: String,         // Conversation title/summary
  status: String,        // open, closed, pending
  
  // Metadata
  startedAt: Date,       // When conversation started
  lastMessageAt: Date,   // Last message timestamp
  source: String,        // Origin channel (web, email, etc.)
  
  // Messages in the conversation
  messages: [{
    id: String,          // Message ID
    timestamp: Date,     // When message was sent
    sender: String,      // 'customer' or 'agent'
    content: String,     // Message content
    attachments: [{      // Optional attachments
      name: String,
      url: String,
      type: String
    }]
  }],
  
  // Context for AI processing
  context: {
    summary: String,     // AI-generated summary of the conversation
    entities: [String],  // Key entities mentioned (products, features, etc.)
    intents: [String],   // Detected intents (question, complaint, etc.)
    sentiment: String,   // Overall sentiment (positive, negative, neutral)
    aiNotes: String      // Additional AI analysis notes
  },
  
  // References to related resources
  references: [{
    type: String,        // Type of reference (ticket, order, etc.)
    id: String,          // ID in the referenced system
    url: String          // URL to the referenced resource
  }]
};

// Export the schemas for use in the application
module.exports = {
  customerProfileSchema,
  conversationSchema,
  
  // Helper function to create a new customer profile
  createCustomerProfile: function(data = {}) {
    const now = new Date();
    return {
      id: data.id || `cust_${Math.random().toString(36).substring(2, 10)}`,
      email: data.email || null,
      name: data.name || null,
      company: data.company || null,
      phoneNumber: data.phoneNumber || null,
      firstContact: now,
      lastContact: now,
      totalConversations: 0,
      tags: data.tags || [],
      crmId: data.crmId || null,
      externalIds: data.externalIds || {},
      attributes: data.attributes || {}
    };
  },
  
  // Helper function to create a new conversation
  createConversation: function(customerId, initialMessage = null) {
    const now = new Date();
    const conversation = {
      id: `conv_${Math.random().toString(36).substring(2, 10)}`,
      customerId: customerId,
      title: "New conversation",
      status: "open",
      startedAt: now,
      lastMessageAt: now,
      source: "web",
      messages: [],
      context: {
        summary: "",
        entities: [],
        intents: [],
        sentiment: "neutral",
        aiNotes: ""
      },
      references: []
    };
    
    // Add initial message if provided
    if (initialMessage) {
      conversation.messages.push({
        id: `msg_${Math.random().toString(36).substring(2, 10)}`,
        timestamp: now,
        sender: 'customer',
        content: initialMessage,
        attachments: []
      });
    }
    
    return conversation;
  },
  
  // Helper function to add a message to a conversation
  addMessage: function(conversation, content, sender = 'customer') {
    const now = new Date();
    const message = {
      id: `msg_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: now,
      sender: sender,
      content: content,
      attachments: []
    };
    
    conversation.messages.push(message);
    conversation.lastMessageAt = now;
    
    return message;
  }
};
