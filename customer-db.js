/**
 * Customer profile and conversation history database
 * Simple file-based storage with JSON persistence
 */

const fs = require('fs');
const path = require('path');
const customerSchema = require('./customer-schema');

class CustomerDatabase {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, 'data');
    this.customersFile = path.join(this.dataDir, 'customers.json');
    this.conversationsFile = path.join(this.dataDir, 'conversations.json');
    
    // Initialize storage
    this.customers = {};
    this.conversations = {};
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Load data if files exist
    this.load();
  }
  
  // Load data from disk
  load() {
    try {
      if (fs.existsSync(this.customersFile)) {
        this.customers = JSON.parse(fs.readFileSync(this.customersFile, 'utf8'));
      }
      
      if (fs.existsSync(this.conversationsFile)) {
        this.conversations = JSON.parse(fs.readFileSync(this.conversationsFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    }
  }
  
  // Save data to disk
  save() {
    try {
      fs.writeFileSync(this.customersFile, JSON.stringify(this.customers, null, 2));
      fs.writeFileSync(this.conversationsFile, JSON.stringify(this.conversations, null, 2));
    } catch (error) {
      console.error('Error saving customer data:', error);
    }
  }
  
  // Customer methods
  
  // Find customer by ID or identifier (email, etc.)
  findCustomer(identifier) {
    // Check for direct ID match
    if (this.customers[identifier]) {
      return this.customers[identifier];
    }
    
    // Check for email match
    for (const id in this.customers) {
      const customer = this.customers[id];
      if (customer.email && customer.email.toLowerCase() === identifier.toLowerCase()) {
        return customer;
      }
    }
    
    // Check for CRM ID match
    for (const id in this.customers) {
      const customer = this.customers[id];
      if (customer.crmId === identifier) {
        return customer;
      }
    }
    
    return null;
  }
  
  // Create a new customer profile
  createCustomer(data) {
    const customer = customerSchema.createCustomerProfile(data);
    this.customers[customer.id] = customer;
    this.save();
    return customer;
  }
  
  // Update customer profile
  updateCustomer(id, data) {
    if (!this.customers[id]) {
      throw new Error(`Customer not found: ${id}`);
    }
    
    // Update fields
    const customer = this.customers[id];
    for (const key in data) {
      if (key !== 'id') { // Don't allow ID to be changed
        customer[key] = data[key];
      }
    }
    
    customer.lastContact = new Date();
    this.save();
    return customer;
  }
  
  // Get all customers
  getAllCustomers() {
    return Object.values(this.customers);
  }
  
  // Conversation methods
  
  // Get conversations for a customer
  getCustomerConversations(customerId) {
    return Object.values(this.conversations)
      .filter(conv => conv.customerId === customerId);
  }
  
  // Find an active conversation for a customer (or create one)
  findOrCreateConversation(customerId, initialMessage = null) {
    // Look for an open conversation
    const activeConversations = Object.values(this.conversations)
      .filter(conv => conv.customerId === customerId && conv.status === 'open');
    
    // Return the most recent active conversation if it exists
    if (activeConversations.length > 0) {
      activeConversations.sort((a, b) => 
        new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      return activeConversations[0];
    }
    
    // Create a new conversation
    return this.createConversation(customerId, initialMessage);
  }
  
  // Create a new conversation
  createConversation(customerId, initialMessage = null) {
    // Check if customer exists
    if (!this.customers[customerId]) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    
    // Create conversation
    const conversation = customerSchema.createConversation(customerId, initialMessage);
    this.conversations[conversation.id] = conversation;
    
    // Update customer's conversation count
    this.customers[customerId].totalConversations += 1;
    this.customers[customerId].lastContact = new Date();
    
    this.save();
    return conversation;
  }
  
  // Add a message to a conversation
  addMessage(conversationId, content, sender = 'customer') {
    if (!this.conversations[conversationId]) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const conversation = this.conversations[conversationId];
    const message = customerSchema.addMessage(conversation, content, sender);
    
    // Update customer's last contact time
    if (this.customers[conversation.customerId]) {
      this.customers[conversation.customerId].lastContact = new Date();
    }
    
    this.save();
    return message;
  }
  
  // Get all messages for a conversation
  getConversationMessages(conversationId) {
    if (!this.conversations[conversationId]) {
      return [];
    }
    
    return this.conversations[conversationId].messages;
  }
  
  // Update conversation status
  updateConversationStatus(conversationId, status) {
    if (!this.conversations[conversationId]) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    this.conversations[conversationId].status = status;
    this.save();
    return this.conversations[conversationId];
  }
  
  // Get conversation by ID
  getConversation(conversationId) {
    return this.conversations[conversationId] || null;
  }
  
  // Update conversation context (for AI)
  updateConversationContext(conversationId, contextData) {
    if (!this.conversations[conversationId]) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const conversation = this.conversations[conversationId];
    
    // Update context fields
    for (const key in contextData) {
      conversation.context[key] = contextData[key];
    }
    
    this.save();
    return conversation;
  }
  
  // CRM Integration methods
  
  // Link customer to CRM
  linkCustomerToCRM(customerId, crmId) {
    if (!this.customers[customerId]) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    
    this.customers[customerId].crmId = crmId;
    this.save();
    return this.customers[customerId];
  }
  
  // Export customer data for CRM
  exportCustomerData(customerId) {
    if (!this.customers[customerId]) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    
    const customer = this.customers[customerId];
    const conversations = this.getCustomerConversations(customerId);
    
    return {
      customer,
      conversations
    };
  }
}

// Export singleton instance
const db = new CustomerDatabase();
module.exports = db;
